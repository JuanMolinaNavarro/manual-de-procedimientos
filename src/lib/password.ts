/**
 * Contraseñas del portal y PIN de firma (solo servidor): hash lento con sal aleatoria.
 *
 * Formato actual: `pbkdf2$<iteraciones>$<sal hex>$<hash hex>` (PBKDF2-SHA256 de node:crypto,
 * 600.000 iteraciones como recomienda OWASP; casi no usa memoria). Hasta 2026-10 se usaba
 * `scrypt$N$r$p$<sal hex>$<hash hex>` (~32 MB por login): se sigue verificando y la contraseña
 * se re-hashea al entrar (`rehash: true`). Los PIN viejos quedan en scrypt (ver `nomina-pin.ts`).
 *
 * Migración: las filas viejas guardan la contraseña en texto plano. `verificarPassword` las
 * acepta (comparación en tiempo constante) y avisa con `rehash: true` para que el login la
 * reemplace por el hash. No hay forma de volver a leer una contraseña: se resetea.
 */

import { createHash, pbkdf2 as pbkdf2Cb, randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'crypto';
import { promisify } from 'util';

const ITERACIONES = 600_000;
const LARGO = 32;

export const PASSWORD_MIN = 8;

const pbkdf2 = promisify(pbkdf2Cb);

function scrypt(input: string, sal: Buffer, largo: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((ok, mal) => scryptCb(input, sal, largo, opts, (e, k) => (e ? mal(e) : ok(k))));
}

export function esHash(guardado: string): boolean {
  return guardado.startsWith('pbkdf2$') || guardado.startsWith('scrypt$');
}

export async function hashSecreto(input: string): Promise<string> {
  const sal = randomBytes(16);
  const h = await pbkdf2(input, sal, ITERACIONES, LARGO, 'sha256');
  return `pbkdf2$${ITERACIONES}$${sal.toString('hex')}$${h.toString('hex')}`;
}

const esHex = (s: string) => /^[0-9a-f]+$/.test(s);
const esEnteroPositivo = (x: number) => Number.isInteger(x) && x > 0;

/** Recalcula el hash de `input` con los parámetros guardados. Formato desconocido o roto → null. */
async function recalcular(input: string, guardado: string): Promise<{ calc: Buffer; esperado: Buffer; actual: boolean } | null> {
  const partes = guardado.split('$');
  if (partes[0] === 'pbkdf2' && partes.length === 4) {
    const [, iter, salHex, hashHex] = partes;
    const nIter = Number(iter);
    if (!esEnteroPositivo(nIter) || !esHex(salHex) || !esHex(hashHex)) return null;
    const esperado = Buffer.from(hashHex, 'hex');
    const calc = await pbkdf2(input, Buffer.from(salHex, 'hex'), nIter, esperado.length, 'sha256');
    return { calc, esperado, actual: nIter === ITERACIONES };
  }
  if (partes[0] === 'scrypt' && partes.length === 6) {
    const [, n, r, p, salHex, hashHex] = partes;
    const nN = Number(n), nR = Number(r), nP = Number(p);
    if (![nN, nR, nP].every(esEnteroPositivo) || !esHex(salHex) || !esHex(hashHex)) return null;
    const esperado = Buffer.from(hashHex, 'hex');
    const calc = await scrypt(input, Buffer.from(salHex, 'hex'), esperado.length, {
      N: nN,
      r: nR,
      p: nP,
      maxmem: Math.max(64 * 1024 * 1024, 256 * nN * nR),
    });
    return { calc, esperado, actual: false };
  }
  return null;
}

/** `ok`: coincide con el hash guardado. `rehash`: coincide pero no está en el formato actual. */
export async function verificarSecreto(input: string, guardado: string): Promise<{ ok: boolean; rehash: boolean }> {
  const r = await recalcular(input, guardado);
  const ok = !!r && r.calc.length === r.esperado.length && timingSafeEqual(r.calc, r.esperado);
  return { ok, rehash: ok && !r?.actual };
}

/** Comparación en tiempo constante (sobre sha256 para igualar largos). */
export function igualesTiempoConstante(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** `ok`: la contraseña coincide. `rehash`: estaba en texto plano o en un formato viejo y hay que hashearla. */
export async function verificarPassword(pw: string, guardado: string): Promise<{ ok: boolean; rehash: boolean }> {
  if (!esHash(guardado)) {
    const ok = igualesTiempoConstante(pw, guardado);
    return { ok, rehash: ok };
  }
  return verificarSecreto(pw, guardado);
}

/** Valida una contraseña nueva. Devuelve un mensaje de error o null. */
export function validarPasswordNueva(pw: unknown): string | null {
  if (typeof pw !== 'string' || pw.trim().length < PASSWORD_MIN) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`;
  }
  if (pw.length > 200) return 'La contraseña es demasiado larga';
  return null;
}
