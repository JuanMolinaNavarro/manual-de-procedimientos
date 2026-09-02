import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { GENESIS, chainHash, pinHash, reciboHash, sha256, verificarCadena, type ConstanciaMin } from './nomina-hash';
import { liquidarEmpleado, maestroSnapshot, reciboMeta, reciboPayload, type EmpleadoNomina, type ReciboPayload } from './nomina-calc';
import { DEFAULT_EMPRESA, DEFAULT_MAESTRO, DEFAULT_NOVEDAD, DEFAULT_PARAMS } from './nomina-datos';

describe('sha256', () => {
  it.each(['', 'hola', 'a'.repeat(55), 'a'.repeat(56), 'ñandú 💜 ' + 'x'.repeat(200)])('coincide con node crypto (len %#)', (s) => {
    expect(sha256(s)).toBe(createHash('sha256').update(s, 'utf8').digest('hex'));
  });
});

describe('pinHash', () => {
  it('es un sha256 del PIN ligado al CUIL sin guiones, y no expone el PIN', () => {
    const h = pinHash('4321', '20-11111111-1');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(sha256('pin:4321:20111111111'));
    expect(h.includes('4321')).toBe(false);
    expect(pinHash(' 4321 ', '20111111111')).toBe(h);
    expect(pinHash('4321', '20-22222222-2')).not.toBe(h);
  });
});

describe('reciboHash', () => {
  const emp: EmpleadoNomina = { id: 1, nombre: 'Carlos González', rol: 'Director', area: 'Dirección', estado: 'active', foto_archivo: null };
  const maestro = { ...DEFAULT_MAESTRO, cuil: '20-11111111-1', fechaIngreso: '2020-01-15', basico: 1_000_000 };
  const payload = (he50 = 0): ReciboPayload => {
    const l = liquidarEmpleado({ empleado: emp, maestro, novedad: { ...DEFAULT_NOVEDAD, he50 }, params: DEFAULT_PARAMS, conceptos: [], periodo: '2026-07', liqAnterior: null });
    return reciboPayload(l, reciboMeta(l, DEFAULT_EMPRESA, maestroSnapshot(maestro), '2026-07'), '2026-08-01T12:00:00.000Z');
  };

  it('es estable ante el reordenamiento de claves (estilo jsonb)', () => {
    const p = payload();
    // jsonb reordena claves: simulamos guardando y releyendo con otro orden
    const invertir = (v: unknown): unknown => {
      if (Array.isArray(v)) return v.map(invertir);
      if (v && typeof v === 'object') {
        const o = v as Record<string, unknown>;
        return Object.fromEntries(Object.keys(o).sort().reverse().map((k) => [k, invertir(o[k])]));
      }
      return v;
    };
    const reordenado = invertir(p) as ReciboPayload;
    expect(JSON.stringify(reordenado)).not.toBe(JSON.stringify(p));
    expect(reciboHash(reordenado)).toBe(reciboHash(p));
  });

  it('cambia si cambia el contenido (reapertura + recálculo)', () => {
    expect(reciboHash(payload(10))).not.toBe(reciboHash(payload(0)));
  });
});

describe('cadena de constancias', () => {
  function armar(n: number): ConstanciaMin[] {
    const out: ConstanciaMin[] = [];
    let prev = GENESIS;
    for (let i = 0; i < n; i++) {
      const base = { hash: 'a'.repeat(64), fecha: `2026-08-0${i + 1}T10:00:00.000Z`, empleado_id: i + 1, periodo: '2026-07', conformidad: i % 2 ? 'disconforme' : 'conforme', observaciones: i % 2 ? 'faltan horas' : '' };
      const chain_hash = chainHash(prev, base);
      out.push({ ...base, prev_hash: prev, chain_hash });
      prev = chain_hash;
    }
    return out;
  }

  it('íntegra, rota al alterar, restaurada, y rota si se manipula prev_hash', () => {
    const c = armar(3);
    expect(verificarCadena(c)).toEqual({ total: 3, rotos: 0 });
    const original = c[1].observaciones;
    c[1].observaciones = 'texto inyectado';
    expect(verificarCadena(c).rotos).toBe(1);
    c[1].observaciones = original;
    expect(verificarCadena(c).rotos).toBe(0);
    c[2].prev_hash = 'f'.repeat(64);
    expect(verificarCadena(c).rotos).toBe(1);
  });

  it('cadena vacía verifica', () => {
    expect(verificarCadena([])).toEqual({ total: 0, rotos: 0 });
  });
});
