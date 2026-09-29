/**
 * Contraseñas del portal (solo servidor): scrypt con sal aleatoria, mismo formato que el PIN
 * de firma (`nomina-pin.ts`): `scrypt$N$r$p$<sal hex>$<hash hex>`.
 *
 * Migración: las filas viejas guardan la contraseña en texto plano. `verificarPassword` las
 * acepta (comparación en tiempo constante) y avisa con `rehash: true` para que el login la
 * reemplace por el hash. No hay forma de volver a leer una contraseña: se resetea.
 */

import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'crypto';

const N = 1 << 15;
const R = 8;
const P = 1;
const LARGO = 32;
const MAXMEM = 64 * 1024 * 1024;

export const PASSWORD_MIN = 8;

function scrypt(pw: string, sal: Buffer, largo: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((ok, mal) => scryptCb(pw, sal, largo, opts, (e, k) => (e ? mal(e) : ok(k))));
}

export function esHash(guardado: string): boolean {
  return guardado.startsWith('scrypt$');
}

export async function hashPassword(pw: string): Promise<string> {
  const sal = randomBytes(16);
  const h = await scrypt(pw, sal, LARGO, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${sal.toString('hex')}$${h.toString('hex')}`;
}

function igualesTiempoConstante(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** `ok`: la contraseña coincide. `rehash`: estaba en texto plano y hay que hashearla. */
export async function verificarPassword(pw: string, guardado: string): Promise<{ ok: boolean; rehash: boolean }> {
  if (!esHash(guardado)) {
    const ok = igualesTiempoConstante(pw, guardado);
    return { ok, rehash: ok };
  }
  const partes = guardado.split('$');
  if (partes.length !== 6) return { ok: false, rehash: false };
  const [, n, r, p, salHex, hashHex] = partes;
  const nN = Number(n), nR = Number(r), nP = Number(p);
  if (![nN, nR, nP].every((x) => Number.isInteger(x) && x > 0) || !/^[0-9a-f]+$/.test(salHex) || !/^[0-9a-f]+$/.test(hashHex)) {
    return { ok: false, rehash: false };
  }
  const esperado = Buffer.from(hashHex, 'hex');
  const calc = await scrypt(pw, Buffer.from(salHex, 'hex'), esperado.length, {
    N: nN,
    r: nR,
    p: nP,
    maxmem: Math.max(MAXMEM, 256 * nN * nR),
  });
  const ok = calc.length === esperado.length && timingSafeEqual(calc, esperado);
  // Parámetros viejos → se re-hashea con los actuales.
  return { ok, rehash: ok && (nN !== N || nR !== R || nP !== P) };
}

/** Valida una contraseña nueva. Devuelve un mensaje de error o null. */
export function validarPasswordNueva(pw: unknown): string | null {
  if (typeof pw !== 'string' || pw.trim().length < PASSWORD_MIN) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`;
  }
  if (pw.length > 200) return 'La contraseña es demasiado larga';
  return null;
}
