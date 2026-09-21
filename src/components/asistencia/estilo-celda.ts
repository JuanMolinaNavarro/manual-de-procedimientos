/**
 * Color + marcador de texto por estado de un día, compartido por el calendario
 * mensual (pestaña Calendario) y el anual (Mi asistencia). El color solo no
 * alcanza para leerlo: por eso cada estado con carga lleva también una letra.
 */

import type { EstadoDia } from '@/lib/asistencia-calendario';

export const ESTILO_CELDA: Record<EstadoDia, { celda: string; marca?: string }> = {
  futuro: { celda: 'bg-transparent' },
  pendiente: { celda: 'bg-muted/60 text-muted-foreground', marca: '·' },
  sin_horario: { celda: 'border border-dashed border-border bg-transparent text-muted-foreground' },
  no_laborable: { celda: 'bg-muted/50' },
  trabajo_no_laborable: { celda: 'bg-sky-400/70 text-sky-950 dark:bg-sky-500/60 dark:text-sky-50', marca: '+' },
  a_horario: { celda: 'bg-emerald-500/70 dark:bg-emerald-500/60' },
  tarde: { celda: 'bg-amber-400/80 text-amber-950 dark:bg-amber-500/70 dark:text-amber-50', marca: 'T' },
  tarde_grave: { celda: 'bg-orange-600/85 text-white dark:bg-orange-500/80', marca: '!' },
  ausente: { celda: 'bg-red-500/65 text-white dark:bg-red-500/60', marca: 'A' },
  feriado: { celda: 'bg-violet-500/25 text-violet-800 dark:bg-violet-500/30 dark:text-violet-200', marca: 'F' },
};

/** Orden en que se listan los estados en la leyenda. */
export const LEYENDA_ESTADOS: EstadoDia[] = ['a_horario', 'tarde', 'tarde_grave', 'ausente', 'trabajo_no_laborable', 'no_laborable', 'feriado', 'sin_horario', 'pendiente'];
