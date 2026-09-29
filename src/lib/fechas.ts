/**
 * Fechas "de calendario" en hora de Argentina (UTC-3, sin horario de verano). Puro: cliente y
 * servidor. `new Date().toISOString().slice(0, 10)` da el día en UTC: desde las 21 h ya es
 * "mañana" (bonificaciones que vencían 3 h antes, período de nómina que saltaba de mes el
 * último día a la noche, bonos y adhesiones fechados al día siguiente).
 */

/** Diferencia de Argentina con UTC, en minutos. */
export const OFFSET_AR_MIN = -180;

/** Día local (Argentina) de un instante, como yyyy-mm-dd. */
export function diaLocal(instante: Date): string {
  return new Date(instante.getTime() + OFFSET_AR_MIN * 60_000).toISOString().slice(0, 10);
}

/** Hoy en Argentina como yyyy-mm-dd. */
export function hoyLocal(ahora = new Date()): string {
  return diaLocal(ahora);
}

/** Mes actual en Argentina como yyyy-mm. */
export function mesLocal(ahora = new Date()): string {
  return hoyLocal(ahora).slice(0, 7);
}
