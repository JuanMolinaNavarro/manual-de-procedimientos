/**
 * Cumpleaños: helpers puros compartidos entre cliente y servidor.
 *
 * `fecha_nacimiento` se guarda como string ISO `yyyy-mm-dd` (igual que todas las
 * fechas de dominio), así que comparar mes-día es comparar strings — sin Date ni
 * corrimientos UTC.
 */

/** Fecha de hoy (ISO yyyy-mm-dd) en horario de Argentina. */
export function hoyISOArgentina(): string {
  // en-CA formatea como yyyy-mm-dd.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date());
}

/**
 * ¿Hoy es el cumpleaños? Compara el `mm-dd` de ambas fechas ISO.
 * Nota: un 29/02 solo matchea en años bisiestos.
 */
export function esCumpleHoy(
  fechaNacimiento: string | null | undefined,
  hoyISO: string = hoyISOArgentina(),
): boolean {
  if (!fechaNacimiento || fechaNacimiento.length < 10) return false;
  return fechaNacimiento.slice(5, 10) === hoyISO.slice(5, 10);
}
