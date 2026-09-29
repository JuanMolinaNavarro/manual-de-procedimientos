/**
 * PIN de firma electrónica de los recibos (solo servidor).
 *
 * - Hash lento: `scrypt` (node:crypto) con sal aleatoria y el CUIL mezclado en la
 *   entrada. Un PIN de 4–8 dígitos tiene como mucho ~10^8 combinaciones: con un hash
 *   rápido (sha256) se recorre entero en segundos si alguien se lleva la base; con
 *   scrypt cada intento cuesta decenas de ms y memoria.
 * - Formato guardado: `scrypt$N$r$p$<sal hex>$<hash hex>` (autodescriptivo: permite
 *   subir los parámetros más adelante sin romper los PIN existentes).
 * - Bloqueo: 5 PIN incorrectos seguidos → 15 minutos. El estado vive en la base
 *   (`NominaAdhesion.pin_fallos` / `pin_bloqueado_hasta`): sobrevive a reinicios.
 *   `estadoBloqueo` es pura (testeada). En la base el intento se reserva ANTES de verificar
 *   (`comprobarPin` en nomina.ts), así pedidos en paralelo no suman más intentos que el límite.
 * - Async: scrypt con ~32 MB por cálculo bloqueaba el event loop si se hacía síncrono.
 */

import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'crypto';
import { PIN_RE } from './nomina-datos';

const N = 1 << 15;
const R = 8;
const P = 1;
const LARGO = 32;
// N=2^15, r=8 → ~32 MB por cálculo: hay que subir el maxmem por defecto (32 MB justos).
const MAXMEM = 64 * 1024 * 1024;

export const PIN_MAX_FALLOS = 5;
export const PIN_BLOQUEO_MS = 15 * 60_000;

function scrypt(input: string, sal: Buffer, largo: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((ok, mal) => scryptCb(input, sal, largo, opts, (e, k) => (e ? mal(e) : ok(k))));
}

function entrada(pin: string, cuil: string): string {
  return `pin:${pin.trim()}:${cuil.replace(/\D/g, '')}`;
}

export async function hashPin(pin: string, cuil: string): Promise<string> {
  const sal = randomBytes(16);
  const h = await scrypt(entrada(pin, cuil), sal, LARGO, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${sal.toString('hex')}$${h.toString('hex')}`;
}

/** true si el PIN corresponde al hash guardado. Formato desconocido → false. */
export async function verificarPin(pin: string, cuil: string, guardado: string): Promise<boolean> {
  const partes = guardado.split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;
  const [, n, r, p, salHex, hashHex] = partes;
  const nN = Number(n), nR = Number(r), nP = Number(p);
  if (![nN, nR, nP].every((x) => Number.isInteger(x) && x > 0) || !/^[0-9a-f]+$/.test(salHex) || !/^[0-9a-f]+$/.test(hashHex)) {
    return false;
  }
  const esperado = Buffer.from(hashHex, 'hex');
  const calc = await scrypt(entrada(pin, cuil), Buffer.from(salHex, 'hex'), esperado.length, {
    N: nN,
    r: nR,
    p: nP,
    maxmem: Math.max(MAXMEM, 256 * nN * nR),
  });
  return calc.length === esperado.length && timingSafeEqual(calc, esperado);
}

/** Valida formato (4–8 dígitos) y que las dos entradas coincidan. Devuelve el PIN o un mensaje. */
export function validarPinNuevo(pin: unknown, pin2: unknown): { ok: true; pin: string } | { ok: false; error: string } {
  const a = typeof pin === 'string' ? pin.trim() : '';
  const b = typeof pin2 === 'string' ? pin2.trim() : '';
  if (!PIN_RE.test(a)) return { ok: false, error: 'El PIN debe tener entre 4 y 8 dígitos' };
  if (a !== b) return { ok: false, error: 'Los PIN no coinciden' };
  return { ok: true, pin: a };
}

export interface EstadoBloqueo {
  bloqueado: boolean;
  segundos: number; // restantes (0 si no está bloqueado)
}

export function estadoBloqueo(hasta: Date | null, ahora: Date = new Date()): EstadoBloqueo {
  if (!hasta || hasta.getTime() <= ahora.getTime()) return { bloqueado: false, segundos: 0 };
  return { bloqueado: true, segundos: Math.ceil((hasta.getTime() - ahora.getTime()) / 1000) };
}

/**
 * Código de adhesión impreso en el acta: ata el papel firmado con el registro.
 * `ADH-<id con 6 dígitos>-<8 hex>`; los 8 hex salen de sha256(empleado|cuil|fecha|pin_hash),
 * así que el código cambia si se altera cualquiera de esos datos del registro.
 */
export function codigoAdhesion(a: { id: number; empleado_id: number; cuil: string; fecha: string; pin_hash: string }): string {
  const h = createHash('sha256')
    .update([a.empleado_id, a.cuil.replace(/\D/g, ''), a.fecha, a.pin_hash].join('|'))
    .digest('hex')
    .slice(0, 8)
    .toUpperCase();
  return `ADH-${String(a.id).padStart(6, '0')}-${h}`;
}
