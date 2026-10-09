/**
 * PIN de firma electrónica de los recibos (solo servidor).
 *
 * - Hash lento: el de las contraseñas (`hashSecreto` de `password.ts`, PBKDF2) con el CUIL
 *   mezclado en la entrada. Un PIN de 4–8 dígitos tiene como mucho ~10^8 combinaciones:
 *   ningún hash lo protege si alguien se lleva la base; lo que lo protege es el bloqueo
 *   por intentos y que la base no salga de la empresa.
 * - Los PIN guardados antes de 2026-10 siguen en scrypt y verifican igual. **No se
 *   re-hashean:** `pin_hash` entra en el código de adhesión impreso en el acta firmada
 *   (`codigoAdhesion`); cambiarlo dejaría el papel sin coincidir con el registro.
 * - Bloqueo: 5 PIN incorrectos seguidos → 15 minutos. El estado vive en la base
 *   (`NominaAdhesion.pin_fallos` / `pin_bloqueado_hasta`): sobrevive a reinicios.
 *   `estadoBloqueo` es pura (testeada). En la base el intento se reserva ANTES de verificar
 *   (`comprobarPin` en nomina.ts), así pedidos en paralelo no suman más intentos que el límite.
 */

import { createHash } from 'crypto';
import { hashSecreto, verificarSecreto } from './password';
import { PIN_RE } from './nomina-datos';

export const PIN_MAX_FALLOS = 5;
export const PIN_BLOQUEO_MS = 15 * 60_000;

function entrada(pin: string, cuil: string): string {
  return `pin:${pin.trim()}:${cuil.replace(/\D/g, '')}`;
}

export function hashPin(pin: string, cuil: string): Promise<string> {
  return hashSecreto(entrada(pin, cuil));
}

/** true si el PIN corresponde al hash guardado. Formato desconocido → false. */
export async function verificarPin(pin: string, cuil: string, guardado: string): Promise<boolean> {
  return (await verificarSecreto(entrada(pin, cuil), guardado)).ok;
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
