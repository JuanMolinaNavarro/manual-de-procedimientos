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

// Aritmética sobre yyyy-mm-dd en UTC. Las fechas que llegan acá son días locales ya resueltos
// (`hoyLocal`), así que no hay que volver a corregir el huso: hacerlo dos veces es justo lo que
// corría las fichadas un día.

export const DIA_MS = 86_400_000;

export function aMs(yyyymmdd: string): number {
  const [a, m, d] = yyyymmdd.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
}

export function aIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Suma (o resta) días a un yyyy-mm-dd. */
export function sumarDias(yyyymmdd: string, dias: number): string {
  return aIso(aMs(yyyymmdd) + dias * DIA_MS);
}

/** Días de `a` a `b` (negativo si `b` es anterior). */
export const diffDias = (a: string, b: string) => Math.round((aMs(b) - aMs(a)) / DIA_MS);

// ─── Meses (yyyy-mm) ─────────────────────────────────────────────────────────

export const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Primer y último día de un `yyyy-mm`. */
export function rangoMes(mes: string): { desde: string; hasta: string } {
  const [a, m] = mes.split('-').map(Number);
  // "Día 0" del mes siguiente: el motor de Date resuelve 28/29/30/31 y el año.
  return { desde: `${mes}-01`, hasta: aIso(Date.UTC(a, m, 0)) };
}

export function mesAnterior(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  return aIso(Date.UTC(a, m - 2, 1)).slice(0, 7);
}

export function mesSiguiente(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  return aIso(Date.UTC(a, m, 1)).slice(0, 7);
}

export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** `2026-09` → `Septiembre 2026`. A mano, sin `Date`, por el huso. */
export function fmtMes(mes: string): string {
  if (!MES_RE.test(mes)) return mes;
  const [a, m] = mes.split('-').map(Number);
  return `${MESES[m - 1]} ${a}`;
}

/**
 * `2026-01-05` (o un ISO con hora) → `05/01/2026`; vacío → `—`. A mano y no con `new Date()`:
 * un yyyy-mm-dd se parsea como medianoche UTC y en Argentina se mostraría el día anterior.
 */
export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}
