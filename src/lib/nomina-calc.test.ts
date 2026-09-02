import { describe, it, expect } from 'vitest';
import {
  aniosAntiguedad,
  canonicalJson,
  contribTotalPct,
  csvLiquidacion,
  liquidarEmpleado,
  maestroSnapshot,
  numeroALetras,
  periodosRacha,
  rankingBono,
  reciboMeta,
  reciboPayload,
  type EmpleadoNomina,
} from './nomina-calc';
import {
  DEFAULT_EMPRESA,
  DEFAULT_MAESTRO,
  DEFAULT_NOVEDAD,
  DEFAULT_PARAMS,
  mergeParams,
  type Concepto,
  type Maestro,
  type Novedad,
  type Params,
} from './nomina-datos';

const EMP: EmpleadoNomina = { id: 1, nombre: 'Carlos González', rol: 'Director', area: 'Dirección', estado: 'active', foto_archivo: null };
const MAESTRO: Maestro = { ...DEFAULT_MAESTRO, cuil: '20-11111111-1', fechaIngreso: '2020-01-15', basico: 1_000_000, categoria: 'A' };

function liq(over: { maestro?: Partial<Maestro>; novedad?: Partial<Novedad>; params?: Partial<Params>; conceptos?: Concepto[]; liqAnterior?: { periodo: string; netos: Record<number, number> } | null } = {}) {
  return liquidarEmpleado({
    empleado: EMP,
    maestro: { ...MAESTRO, ...over.maestro },
    novedad: { ...DEFAULT_NOVEDAD, ...over.novedad },
    params: { ...DEFAULT_PARAMS, ...over.params },
    conceptos: over.conceptos ?? [],
    periodo: '2026-07',
    liqAnterior: over.liqAnterior ?? null,
  });
}
const item = (l: ReturnType<typeof liq>, nombre: string) => [...l.rem, ...l.norem, ...l.ded].find((x) => x.nombre === nombre);

describe('numeroALetras', () => {
  it.each([
    [0, 'pesos cero con 00/100'],
    [21.5, 'pesos veintiuno con 50/100'],
    [100, 'pesos cien con 00/100'],
    [131, 'pesos ciento treinta y uno con 00/100'],
    [1000, 'pesos mil con 00/100'],
    [1e6, 'pesos un millón con 00/100'],
    [2345678.09, 'pesos dos millones trescientos cuarenta y cinco mil seiscientos setenta y ocho con 09/100'],
    [999999.99, 'pesos novecientos noventa y nueve mil novecientos noventa y nueve con 99/100'],
  ])('%s', (n, esperado) => {
    expect(numeroALetras(n)).toBe(esperado);
  });
});

describe('migración de parámetros', () => {
  it('reparte el viejo `contribuciones` conservando el total', () => {
    const p = mergeParams({ contribuciones: 26.4, art: 4 });
    expect(p.cSegSocial).toBe(18.9);
    expect('contribuciones' in p).toBe(false);
    expect(contribTotalPct(p)).toBeCloseTo(30.4, 9);
  });
  it('ignora valores no numéricos', () => {
    expect(mergeParams({ jubilacion: 'x', art: null }).jubilacion).toBe(DEFAULT_PARAMS.jubilacion);
  });
});

describe('motor de cálculo', () => {
  it('contribuciones patronales por rubro y costo empresa', () => {
    const l = liq();
    expect(l.contribs.length).toBeGreaterThan(0);
    const suma = l.contribs.reduce((s, c) => s + c.monto, 0);
    expect(Math.abs(l.totalContrib - suma)).toBeLessThan(0.01);
    expect(Math.abs(l.costoEmpresa - (l.totalRem + l.totalContrib + l.totalNoRem))).toBeLessThan(0.01);
    expect(Math.abs(l.totalContrib - l.totalRem * 0.304)).toBeLessThan(1);
  });

  it('antigüedad: años completos × % del básico', () => {
    expect(aniosAntiguedad('2020-01-15', '2026-07')).toBe(6);
    expect(item(liq(), 'Antigüedad')?.monto).toBeCloseTo(1_000_000 * 0.01 * 6, 2);
    expect(item(liq({ maestro: { fechaIngreso: '' } }), 'Antigüedad')).toBeUndefined();
  });

  it('presentismo cae con faltas injustificadas pero no con días sin goce', () => {
    expect(item(liq(), 'Presentismo')).toBeDefined();
    expect(item(liq({ novedad: { faltasInj: 1 } }), 'Presentismo')).toBeUndefined();
    const sinGoce = liq({ novedad: { diasSinGoce: 2 } });
    expect(item(sinGoce, 'Presentismo')).toBeDefined();
    expect(item(sinGoce, 'Sueldo básico')?.monto).toBeCloseTo(1_000_000 - 2 * (1_000_000 / 30), 2);
  });

  it('horas extra usan el divisor de hora', () => {
    const l = liq({ novedad: { he50: 10, he100: 4 } });
    expect(item(l, 'Horas extra 50%')?.monto).toBeCloseTo(10 * 5000 * 1.5, 2);
    expect(item(l, 'Horas extra 100%')?.monto).toBeCloseTo(4 * 5000 * 2, 2);
  });

  it('plus vacacional = días × (básico/25 − básico/30)', () => {
    const l = liq({ novedad: { diasVacaciones: 14 } });
    expect(item(l, 'Plus vacacional')?.monto).toBeCloseTo(14 * (1_000_000 / 25 - 1_000_000 / 30), 2);
  });

  it('cuota sindical solo a afiliados', () => {
    expect(item(liq(), 'Cuota sindical')).toBeUndefined();
    const l = liq({ maestro: { afiliado: true } });
    expect(item(l, 'Cuota sindical')?.monto).toBeCloseTo(l.totalRem * 0.02, 2);
  });

  it('conceptos adicionales activos por tipo y cálculo', () => {
    const conceptos: Concepto[] = [
      { id: 1, nombre: 'Premio fijo', tipo: 'rem', calculo: 'monto', valor: 10000, activo: true, orden: 0 },
      { id: 2, nombre: 'Viáticos', tipo: 'norem', calculo: 'pct_basico', valor: 5, activo: true, orden: 1 },
      { id: 3, nombre: 'Comedor', tipo: 'ded', calculo: 'pct_rem', valor: 1, activo: true, orden: 2 },
      { id: 4, nombre: 'Inactivo', tipo: 'rem', calculo: 'monto', valor: 999, activo: false, orden: 3 },
    ];
    const l = liq({ conceptos });
    expect(item(l, 'Premio fijo')?.monto).toBe(10000);
    expect(item(l, 'Viáticos')?.monto).toBeCloseTo(50000, 2);
    expect(item(l, 'Comedor')?.monto).toBeCloseTo(l.totalRem * 0.01, 2);
    expect(item(l, 'Inactivo')).toBeUndefined();
  });

  it('flags: básico, CUIL, ingreso, neto, tope y variación', () => {
    const msgs = (l: ReturnType<typeof liq>) => l.flags.map((f) => f.tipo + ':' + f.msg);
    expect(msgs(liq({ maestro: { basico: 0 } }))).toContain('error:Sin sueldo básico cargado en el Maestro');
    expect(msgs(liq({ maestro: { cuil: '' } }))).toContain('warn:Falta CUIL en el Maestro');
    expect(msgs(liq({ maestro: { fechaIngreso: '' } }))).toContain('warn:Falta fecha de ingreso (la antigüedad calcula 0)');
    expect(msgs(liq()).some((m) => m.startsWith('error'))).toBe(false);
    // embargo enorme → neto negativo + deducciones altas
    const grave = liq({ novedad: { embargos: 2_000_000 } });
    expect(msgs(grave)).toContain('error:El neto da cero o negativo');
    expect(msgs(grave).some((m) => m.startsWith('warn:Deducciones altas'))).toBe(true);
    // variación vs último cerrado
    const base = liq();
    const conVar = liq({ liqAnterior: { periodo: '2026-06', netos: { 1: base.neto * 2 } } });
    expect(msgs(conVar).some((m) => m.includes('% vs Junio 2026'))).toBe(true);
    const sinVar = liq({ liqAnterior: { periodo: '2026-06', netos: { 1: base.neto } } });
    expect(msgs(sinVar).some((m) => m.includes(' vs '))).toBe(false);
  });
});

describe('recibo canónico', () => {
  it('canonicalJson no depende del orden de las claves ni de undefined', () => {
    const a = { z: 1, a: { y: [1, { b: 2, a: 1 }], x: 'q' }, u: undefined };
    const b = { a: { x: 'q', y: [1, { a: 1, b: 2 }] }, z: 1 };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(canonicalJson(a)).toBe('{"a":{"x":"q","y":[1,{"a":1,"b":2}]},"z":1}');
  });

  it('el payload usa los snapshots, no los datos vivos', () => {
    const l = liq();
    const empresa = { ...DEFAULT_EMPRESA, razonSocial: 'Central Org SRL', cuit: '30-71234567-8', cctDefault: 'CCT 130/75' };
    const snap = maestroSnapshot(MAESTRO);
    const p1 = reciboPayload(l, reciboMeta(l, empresa, snap, '2026-07'), '2026-08-01T00:00:00.000Z');
    expect(p1.version).toBe('anexoIII-1');
    expect(p1.trabajador.cct).toBe('CCT 130/75');
    // editar empresa/maestro "después" no toca el snapshot
    empresa.cuit = '30-99999999-9';
    const p2 = reciboPayload(l, reciboMeta(l, { ...DEFAULT_EMPRESA, razonSocial: 'Central Org SRL', cuit: '30-71234567-8', cctDefault: 'CCT 130/75' }, snap, '2026-07'), '2026-08-01T00:00:00.000Z');
    expect(canonicalJson(p1)).toBe(canonicalJson(p2));
  });

  it('cambiar novedades cambia el payload', () => {
    const a = liq(), b = liq({ novedad: { he50: 10 } });
    const meta = (l: typeof a) => reciboMeta(l, DEFAULT_EMPRESA, maestroSnapshot(MAESTRO), '2026-07');
    expect(canonicalJson(reciboPayload(a, meta(a), null))).not.toBe(canonicalJson(reciboPayload(b, meta(b), null)));
  });
});

describe('bonos', () => {
  const emp2: EmpleadoNomina = { ...EMP, id: 2, nombre: 'Ana Fernández', area: 'RRHH' };
  it('racha de presentismo cuenta meses seguidos sin faltas', () => {
    const periodos = periodosRacha(['2026-05', '2026-06'], '2026-07', false);
    expect(periodos).toEqual(['2026-05', '2026-06', '2026-07']);
    const nov = { '2026-06': { 1: { ...DEFAULT_NOVEDAD, faltasInj: 1 } } };
    const rk = rankingBono({ ambito: 'empresa', metrica: 'racha_presentismo' }, [EMP, emp2], nov, periodos, '2026-07');
    expect(rk[0].emp.id).toBe(2);
    expect(rk[0].valor).toBe(3);
    expect(rk[1].valor).toBe(1);
    expect(rk[1].racha.map((r) => r.ok)).toEqual([true, false, true]);
  });
  it('bonos por área filtran el pool', () => {
    const nov = { '2026-07': { 1: { ...DEFAULT_NOVEDAD, he50: 9 }, 2: { ...DEFAULT_NOVEDAD, he50: 3 } } };
    const rk = rankingBono({ ambito: 'RRHH', metrica: 'horas_extra' }, [EMP, emp2], nov, [], '2026-07');
    expect(rk.map((r) => r.emp.id)).toEqual([2]);
    expect(rk[0].valor).toBe(3);
  });
});

describe('csv', () => {
  it('lleva BOM, separador ; y una fila por liquidación', () => {
    const csv = csvLiquidacion('2026-07', [liq()], { 1: '20-11111111-1' });
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).split('\n');
    expect(lines[0]).toBe('Periodo;Empleado;CUIL;Rol;Area;Basico;Total Remunerativo;Total No Remunerativo;Total Deducciones;Neto;Costo Empresa');
    expect(lines[1].startsWith('2026-07;Carlos González;20-11111111-1;Director;Dirección;1000000;')).toBe(true);
  });
});
