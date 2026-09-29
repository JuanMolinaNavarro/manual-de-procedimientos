import { beforeAll, describe, it, expect } from 'vitest';
import {
  PIN_BLOQUEO_MS,
  codigoAdhesion,
  estadoBloqueo,
  hashPin,
  validarPinNuevo,
  verificarPin,
} from './nomina-pin';

const CUIL = '20-11111111-2'; // ficticio

describe('hashPin / verificarPin', () => {
  let h = '';
  beforeAll(async () => {
    h = await hashPin('4821', CUIL);
  });

  it('formato scrypt autodescriptivo y sin el PIN', () => {
    expect(h).toMatch(/^scrypt\$32768\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    expect(h).not.toContain('4821');
  });
  it('verifica el PIN correcto (con o sin guiones en el CUIL, con espacios)', async () => {
    expect(await verificarPin('4821', CUIL, h)).toBe(true);
    expect(await verificarPin(' 4821 ', '20111111112', h)).toBe(true);
  });
  it('rechaza otro PIN u otro CUIL', async () => {
    expect(await verificarPin('4822', CUIL, h)).toBe(false);
    expect(await verificarPin('4821', '27-22222222-3', h)).toBe(false);
  });
  it('dos hashes del mismo PIN difieren (sal aleatoria)', async () => {
    expect(await hashPin('4821', CUIL)).not.toBe(h);
  });
  it('un hash malformado o de formato viejo nunca verifica', async () => {
    expect(await verificarPin('4821', CUIL, 'abc')).toBe(false);
    expect(await verificarPin('4821', CUIL, 'a'.repeat(64))).toBe(false);
    expect(await verificarPin('4821', CUIL, 'scrypt$x$8$1$00$00')).toBe(false);
  });
});

describe('validarPinNuevo', () => {
  it('acepta 4 a 8 dígitos iguales', () => expect(validarPinNuevo('12345678', '12345678')).toEqual({ ok: true, pin: '12345678' }));
  it('rechaza formato y diferencias', () => {
    expect(validarPinNuevo('123', '123')).toMatchObject({ ok: false });
    expect(validarPinNuevo('12a4', '12a4')).toMatchObject({ ok: false });
    expect(validarPinNuevo('1234', '1235')).toEqual({ ok: false, error: 'Los PIN no coinciden' });
  });
});

describe('bloqueo', () => {
  const t0 = new Date('2026-09-24T12:00:00Z');
  it('bloqueado mientras no pasa el plazo', () => {
    const hasta = new Date(t0.getTime() + PIN_BLOQUEO_MS);
    expect(estadoBloqueo(hasta, t0)).toEqual({ bloqueado: true, segundos: 900 });
  });
  it('pasado el plazo se puede reintentar', () => {
    const hasta = new Date(t0.getTime() + PIN_BLOQUEO_MS);
    expect(estadoBloqueo(hasta, new Date(hasta.getTime() - 1000)).bloqueado).toBe(true);
    expect(estadoBloqueo(hasta, hasta)).toEqual({ bloqueado: false, segundos: 0 });
    expect(estadoBloqueo(null, t0).bloqueado).toBe(false);
  });
});

describe('codigoAdhesion', () => {
  const base = { id: 12, empleado_id: 113, cuil: '20-11111111-2', fecha: '2026-09-24', pin_hash: 'scrypt$x' };
  it('formato y estabilidad', () => {
    const c = codigoAdhesion(base);
    expect(c).toMatch(/^ADH-000012-[0-9A-F]{8}$/);
    expect(codigoAdhesion({ ...base, cuil: '20111111112' })).toBe(c);
  });
  it('cambia si cambia el registro', () => {
    expect(codigoAdhesion({ ...base, pin_hash: 'scrypt$y' })).not.toBe(codigoAdhesion(base));
    expect(codigoAdhesion({ ...base, fecha: '2026-09-25' })).not.toBe(codigoAdhesion(base));
  });
});
