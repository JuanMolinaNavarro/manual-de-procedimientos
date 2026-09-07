/**
 * Constantes y tipos del módulo Asistencia (relojes biométricos Anviz).
 * Sin dependencias de servidor: se importa desde cliente y servidor.
 */

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
export const OFFSET_RELOJ_MIN = -180;

/** Modo de descarga de registros del reloj. */
export type ModoDescarga = 'nuevos' | 'todos';

/** Filtros de la consulta de fichadas (query string de la API). */
export interface FiltrosFichadas {
  desde: string; // yyyy-mm-dd (local)
  hasta: string; // yyyy-mm-dd (local, inclusive)
  relojId?: number;
  userId?: string;
  q?: string; // búsqueda por nombre / user_id
  soloSospechosas?: boolean;
}

/** Hoy en hora local de Argentina como yyyy-mm-dd. */
export function hoyLocal(ahora = new Date()): string {
  return new Date(ahora.getTime() + OFFSET_RELOJ_MIN * 60_000).toISOString().slice(0, 10);
}

/** Primer día del mes de `fecha` (yyyy-mm-dd). */
export function inicioDeMes(fecha: string): string {
  return fecha.slice(0, 7) + '-01';
}

export const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
