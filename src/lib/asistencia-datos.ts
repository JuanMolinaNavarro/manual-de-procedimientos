/**
 * Constantes y tipos del módulo Asistencia (relojes biométricos Anviz).
 * Sin dependencias de servidor: se importa desde cliente y servidor.
 */

import { OFFSET_AR_MIN, hoyLocal } from './fechas';

/** Tipo de marca (byte "record type" del reloj; tabla Status de CrossChex). */
export const TIPOS_MARCA: Record<number, string> = {
  0: 'Entrada',
  1: 'Salida',
  2: 'Descanso',
  3: 'Horas extra',
};

export function tipoMarcaLabel(tipo: number): string {
  return TIPOS_MARCA[tipo] ?? `Tipo ${tipo}`;
}

/** Modo de verificación ("backup code"). Etiquetas orientativas del protocolo TC-B. */
export const MODOS_MARCA: Record<number, string> = {
  0: 'Clave',
  1: 'Huella',
  2: 'Tarjeta',
  4: 'Tarjeta',
  8: 'Rostro',
};

export function modoMarcaLabel(modo: number | null | undefined): string {
  if (modo == null) return '';
  return MODOS_MARCA[modo] ?? `Modo ${modo}`;
}

/** Puerto TCP por defecto del protocolo Anviz TC-B. */
export const PUERTO_TCB = 5010;

/** Orígenes de una fichada. */
export const ORIGEN_RELOJ = 'reloj';
export const ORIGEN_CROSSCHEX = 'crosschex';

/** Máximo de registros que devuelve el reloj por trama (cmd 0x40). */
export const MAX_REGISTROS_POR_TRAMA = 25;

/**
 * Una fichada con fecha más allá de este margen sobre "hoy" es de un reloj con la
 * hora mal puesta: se guarda igual (para no perderla) pero la UI la resalta.
 */
export const MARGEN_FECHA_FUTURA_MS = 24 * 60 * 60 * 1000;

export function esFechaImposible(fechaHoraIso: string, ahora = Date.now()): boolean {
  const t = Date.parse(fechaHoraIso);
  return !Number.isFinite(t) || t > ahora + MARGEN_FECHA_FUTURA_MS || t < Date.parse('2010-01-01T00:00:00Z');
}

/** Zona horaria fija de los relojes (Argentina, sin horario de verano). */
export const OFFSET_RELOJ_MIN = OFFSET_AR_MIN;

/** Modo de descarga de registros del reloj. */
export type ModoDescarga = 'nuevos' | 'todos';

/** Filtros de la consulta de fichadas (query string de la API). */
export interface FiltrosFichadas {
  desde: string; // yyyy-mm-dd (local)
  hasta: string; // yyyy-mm-dd (local, inclusive)
  relojId?: number;
  userId?: string;
  q?: string; // búsqueda por nombre / user_id
  /** Solo fichadas con fecha imposible. Ignora el rango: por definición cae afuera. */
  soloSospechosas?: boolean;
  /** Solo días sin marca de salida. Aplica únicamente a la vista por día. */
  soloIncompletos?: boolean;
}

/** Hoy en hora local de Argentina como yyyy-mm-dd (vive en `fechas.ts`). */
export { hoyLocal };

/** Primer día del mes de `fecha` (yyyy-mm-dd). */
export function inicioDeMes(fecha: string): string {
  return fecha.slice(0, 7) + '-01';
}

export const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

// ─── Rangos de fecha ────────────────────────────────────────────────────────
// Todo se calcula sobre yyyy-mm-dd en UTC. Las fechas del módulo son días
// locales ya resueltos (`hoyLocal`), así que acá no hay que volver a corregir
// el huso: hacerlo dos veces es justo lo que corría las fichadas un día.

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

export type PresetRango = 'hoy' | 'semana' | 'mes' | 'mesAnterior' | 'ultimos30';

export const PRESETS_RANGO: { id: PresetRango; label: string }[] = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'mes', label: 'Este mes' },
  { id: 'mesAnterior', label: 'Mes anterior' },
  { id: 'ultimos30', label: 'Últimos 30' },
];

export function rangoPreset(preset: PresetRango, hoy = hoyLocal()): { desde: string; hasta: string } {
  const [a, m] = hoy.split('-').map(Number);
  switch (preset) {
    case 'hoy':
      return { desde: hoy, hasta: hoy };
    case 'semana': {
      // Semana que arranca el lunes. getUTCDay(): 0 domingo … 6 sábado.
      const dow = new Date(aMs(hoy)).getUTCDay();
      return { desde: sumarDias(hoy, -((dow + 6) % 7)), hasta: hoy };
    }
    case 'mes':
      return { desde: inicioDeMes(hoy), hasta: hoy };
    case 'mesAnterior':
      // Índice de mes m-2 (0-based) y "día 0" del mes m-1: el motor de Date
      // resuelve solo el cambio de año.
      return { desde: aIso(Date.UTC(a, m - 2, 1)), hasta: aIso(Date.UTC(a, m - 1, 0)) };
    case 'ultimos30':
      return { desde: sumarDias(hoy, -29), hasta: hoy };
  }
}

/**
 * Preset que produce exactamente este rango, o null si es uno a mano. Sirve para
 * marcar el chip activo cuando el rango viene de la URL.
 *
 * Dos presets pueden coincidir (un lunes, "Hoy" y "Esta semana" son el mismo
 * día): se devuelve el primero de `PRESETS_RANGO`, que es el más específico.
 */
export function presetDeRango(desde: string, hasta: string, hoy = hoyLocal()): PresetRango | null {
  for (const { id } of PRESETS_RANGO) {
    const r = rangoPreset(id, hoy);
    if (r.desde === desde && r.hasta === hasta) return id;
  }
  return null;
}

/**
 * Filas por página en todas las tablas del módulo (fichadas, días y personas).
 * Vive acá para que el corte del server y el de las tablas que paginan en el
 * navegador sean el mismo número: si difieren, el pie dice "página 2 de 3" y la
 * tabla muestra otra cosa.
 */
export const FILAS_POR_PAGINA = 15;

// ─── Actividad de una persona ───────────────────────────────────────────────
// El alta/baja es SIEMPRE manual (switch de la pestaña Personas). No hay
// archivado por silencio ni reactivación automática por fichada: se probaron y
// se sacaron porque pisaban decisiones tomadas a mano.

/** Valores de `OrgEmpleado.estado`. */
export const ESTADO_EMPLEADO_ACTIVO = 'active';
export const ESTADO_EMPLEADO_INACTIVO = 'inactive';

/**
 * Actividad efectiva de una persona del reloj. Una sola fuente de verdad por
 * caso: si está vinculada manda el organigrama; si no, su propio `activo`.
 */
export function personaActiva(p: { empleadoId: number | null; activo: boolean; empleadoEstado: string | null }): boolean {
  if (p.empleadoId != null) return p.empleadoEstado === ESTADO_EMPLEADO_ACTIVO;
  return p.activo;
}

// ─── Formato de fechas ──────────────────────────────────────────────────────
// Todo el módulo muestra la hora del reloj, que es hora de Argentina. Se fija la
// zona a mano en vez de dejar la del navegador: si alguien abre el panel desde
// otro huso, las fichadas tienen que seguir leyéndose como las marcó la persona.
// `hour12: false` porque algunos navegadores con es-AR muestran "10:49 a. m.".

export const TZ_RELOJ = 'America/Argentina/Buenos_Aires';

/** 08:32:11 */
export function fmtHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: TZ_RELOJ });
}

/** 08:32 */
export function fmtHoraCorta(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ_RELOJ });
}

/** 05/09/2026 08:32 */
export function fmtFechaHora(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ_RELOJ });
}

/**
 * `2026-01-05` → `05/01/2026`. A mano y no con `new Date()`: un yyyy-mm-dd se
 * parsea como medianoche UTC y en Argentina (-03:00) se mostraría el día anterior.
 */
export function fmtFechaDia(yyyymmdd: string): string {
  if (!FECHA_RE.test(yyyymmdd)) return yyyymmdd;
  const [a, m, d] = yyyymmdd.split('-');
  return `${d}/${m}/${a}`;
}

/** `2026-10-07` → `miércoles 7 de octubre`. Al mediodía UTC, así el huso no corre el día. */
export function fmtDiaLargo(yyyymmdd: string): string {
  if (!FECHA_RE.test(yyyymmdd)) return yyyymmdd;
  return new Date(`${yyyymmdd}T12:00:00Z`).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).replace(',', '');
}

/** "hace 12 min" / "hace 3 h" / "hace 2 días". Fechas futuras → "recién". */
export function fmtRelativo(iso: string | null, ahora = Date.now()): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  const seg = Math.floor((ahora - t) / 1000);
  if (seg < 0) return 'recién';
  if (seg < 60) return 'hace segundos';
  const min = Math.floor(seg / 60);
  if (min < 60) return `hace ${min} min`;
  const hs = Math.floor(min / 60);
  if (hs < 24) return `hace ${hs} h`;
  const dias = Math.floor(hs / 24);
  return dias === 1 ? 'hace 1 día' : `hace ${dias} días`;
}
