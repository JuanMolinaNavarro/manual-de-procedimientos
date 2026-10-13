/**
 * Lectura de la asistencia para RR.HH. (vistas Día y Mes, y el día por día del perfil): en qué
 * lista va cada persona un día, el resumen de una persona en un mes y la explicación en palabras
 * de cómo se calculó un día. Todo sale de las celdas de `evaluarDia`; acá no se calcula nada
 * nuevo, solo se lee. Puro: cliente y servidor (`asistencia-tablero-calc.test.ts`).
 */

import { fmtHoraCorta } from './asistencia-datos';
import { fmtHorasMin, minutosDe, type CeldaDia, type ResumenLiquidacion } from './asistencia-calendario';

/**
 * Minutos de tardanza de un día: solo si llegó fuera de tolerancia. Dentro de la tolerancia el
 * día es "a horario" y esos minutos no son tardanza (así coincide con el resumen del mes).
 */
export const tardanza = (c: CeldaDia): number => (c.estado === 'tarde' || c.estado === 'tarde_grave' ? c.minutosTarde ?? 0 : 0);

/** Llegó tarde, pero ese mismo día se quedó después de hora al menos el mismo tiempo. */
export const compensada = (c: CeldaDia): boolean => tardanza(c) > 0 && (c.extra?.compensado ?? 0) >= tardanza(c);

/** Horas extra del día (50 % + 100 %), en bloques de media hora: 1.5 = 1 h 30 min. */
export const horasExtraDia = (c: CeldaDia): number => (c.extra ? c.extra.horas50 + c.extra.horas100 : 0);

/**
 * Minutos que se quedó después de la salida esperada (o todo lo trabajado en un día no laborable),
 * antes de compensar la tardanza y de contar bloques.
 */
export const minutosDespues = (c: CeldaDia): number => (c.extra ? c.extra.compensado + c.extra.minutos50 + c.extra.minutos100 : 0);

/** 45 → "45 min"; 90 → "1 h 30 min". */
export const fmtMinutos = (min: number): string => (min >= 60 ? fmtHorasMin(min) : `${min} min`);

/** Horas extra (de a media hora) para mostrar: 1.5 → "1 h 30 min"; 0.5 → "30 min"; 0 → "0 h". */
export const fmtHorasExtra = (h: number): string => (h ? fmtMinutos(Math.round(h * 60)) : '0 h');

/** `plural(3, 'vez', 'veces')` → "3 veces". */
export const plural = (n: number, uno: string, varios: string): string => `${n} ${n === 1 ? uno : varios}`;

/** Llegadas tarde del mes que se compensaron completas (mismo criterio que `compensada`). */
export const tardesCompensadas = (r: Pick<ResumenLiquidacion, 'tardes'>): number => r.tardes.filter((t) => t.recuperado >= t.minutos).length;

// ─── Vista Día ──────────────────────────────────────────────────────────────

export type GrupoDia = 'a_horario' | 'tarde' | 'tarde_grave' | 'sin_entrada' | 'sin_fichar' | 'entra_mas_tarde' | 'falto';

/**
 * Lista del día en la que va una persona, o null si ese día no se la esperaba (franco, feriado,
 * sin horario). `ahoraMin` (minuto local de ahora) separa, hoy, a quien todavía no fichó de quien
 * entra más tarde: `pendiente` solo existe en el día de hoy.
 */
export function grupoDelDia(c: CeldaDia, ahoraMin: number): GrupoDia | null {
  switch (c.estado) {
    case 'a_horario':
    case 'tarde':
    case 'tarde_grave':
    case 'sin_entrada':
      return c.estado;
    case 'ausente':
    case 'justificado': // sigue en «No vinieron», con su etiqueta
      return 'falto';
    case 'pendiente':
      return c.jornada && minutosDe(c.jornada.entrada) > ahoraMin ? 'entra_mas_tarde' : 'sin_fichar';
    default:
      return null;
  }
}

/** Lo que quedó para revisar de un día ya cerrado. */
export function pendienteDeRevisar(c: CeldaDia): 'falto' | 'sin_entrada' | 'sin_salida' | null {
  if (c.estado === 'ausente') return 'falto';
  if (c.estado === 'sin_entrada') return 'sin_entrada';
  return c.sinSalida ? 'sin_salida' : null;
}

// ─── Vista Mes ──────────────────────────────────────────────────────────────

/** Una persona en un mes, en los números que mira quien liquida. */
export interface ResumenMesPersona {
  minutosTrabajados: number;
  /** Hasta hoy si el mes está en curso; si no, el mes entero. */
  minutosEsperados: number;
  tardes: number;
  compensadas: number;
  minutosTarde: number;
  extra50: number;
  extra100: number;
  faltas: number;
  /** Inasistencias con justificativo aprobado (no son faltas). */
  justificadas: number;
  /** Días con una marca faltante (sin salida o sin entrada). */
  sinMarca: number;
}

/** Porcentaje (0–100) de las horas esperadas que trabajó, para la barra. */
export const porcentajeHoras = (r: Pick<ResumenMesPersona, 'minutosTrabajados' | 'minutosEsperados'>): number =>
  r.minutosEsperados > 0 ? Math.min(100, Math.round((r.minutosTrabajados / r.minutosEsperados) * 100)) : 0;

export function resumenMesPersona(r: ResumenLiquidacion, hoyEnMes: boolean): ResumenMesPersona {
  return {
    minutosTrabajados: r.minutosTrabajados,
    minutosEsperados: hoyEnMes ? r.minutosEsperadosHastaHoy : r.minutosEsperadosMes,
    tardes: r.tardes.length,
    compensadas: tardesCompensadas(r),
    minutosTarde: r.minutosTarde,
    extra50: r.horasExtra50,
    extra100: r.horasExtra100,
    faltas: r.ausentes.length,
    justificadas: r.justificados.length,
    sinMarca: r.sinSalida.length + r.sinEntrada.length,
  };
}

// ─── Cómo se calculó un día ─────────────────────────────────────────────────

/**
 * El cálculo de un día en frases cortas, para que RR.HH. pueda contestarle a la persona sin
 * leer reglas. No menciona la tolerancia (decisión del usuario: se ve solo en el editor de
 * horarios) y cuenta la hora extra como se liquida: de a media hora completa.
 */
export function explicarDia(c: CeldaDia): string[] {
  const j = c.jornada;
  if (c.estado === 'sin_horario') return ['No tiene horario cargado ese día: solo se muestran sus marcas.'];
  if (c.estado === 'feriado') return ['Ese día casi nadie fichó: se toma como feriado y no cuenta como falta.'];
  if (c.estado === 'ausente' && j) return [`Tenía que entrar a las ${j.entrada} y no hay ninguna marca del reloj.`];
  if (c.estado === 'justificado') return ['No vino, pero tiene un justificativo aprobado por RR.HH.: se paga y no cuenta como falta.'];
  if (c.estado === 'pendiente' && j) return [`Entra a las ${j.entrada}. Todavía no hay marcas.`];

  const out: string[] = [];
  const t = tardanza(c);
  if (c.estado === 'trabajo_no_laborable') out.push('Vino un día que no tenía asignado: todo lo que trabajó cuenta como hora extra.');
  if (c.estado === 'sin_entrada') out.push('Solo hay una marca de salida: no se sabe a qué hora entró, así que no cuenta como llegada tarde. Hay que verificarlo.');
  if (c.entradaInferida) out.push('No hubo marca de entrada: se tomó como entrada la primera marca del día.');
  if (t && j) out.push(`Llegó ${fmtMinutos(t)} tarde: tenía que entrar a las ${j.entrada}.`);
  else if (c.estado === 'a_horario' && c.entrada) out.push(`Entró a horario, a las ${fmtHoraCorta(c.entrada)}.`);
  if (c.sinSalida) out.push('No hay marca de salida: las horas de ese día no se cuentan.');

  if (c.extra && j && c.estado !== 'trabajo_no_laborable') {
    const despues = minutosDespues(c);
    if (despues > 0) out.push(`Se quedó ${fmtMinutos(despues)} después de las ${j.salida}.`);
    if (t) {
      if (compensada(c)) out.push('Eso cubre la llegada tarde: queda compensada.');
      else if (c.extra.compensado > 0) out.push(`Eso compensa ${fmtMinutos(c.extra.compensado)} de la llegada tarde.`);
      else out.push('La llegada tarde no se compensó.');
    }
  }
  if (c.extra) {
    const partes = [c.extra.horas50 && `${fmtHorasExtra(c.extra.horas50)} al 50 %`, c.extra.horas100 && `${fmtHorasExtra(c.extra.horas100)} al 100 %`].filter(Boolean);
    const restante = c.extra.minutos50 + c.extra.minutos100;
    if (partes.length) out.push(`Suma ${partes.join(' y ')} de hora extra.`);
    else if (restante > 0) out.push(`Los ${fmtMinutos(restante)} que quedan no suman hora extra: se cuenta de a media hora completa.`);
  }
  if (c.minutosTrabajados != null && c.entrada && c.salida) {
    out.push(`Trabajó ${fmtHorasMin(c.minutosTrabajados)}, de ${fmtHoraCorta(c.entrada)} a ${fmtHoraCorta(c.salida)}.`);
  }
  return out;
}
