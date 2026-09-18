/**
 * Calendario de asistencia: horario esperado de cada empleado (versionado por
 * vigencia) y estado derivado de cada día del mes.
 *
 * Sin dependencias de servidor: se importa desde cliente y servidor, y es lo
 * único que se testea (`asistencia-calendario.test.ts`).
 *
 * Reglas que conviene tener a mano:
 * - Los días de la semana van 0 = lunes … 6 = domingo (mismo orden que la UI
 *   "L M X J V S D"). No es el `getDay()` de JS, que arranca en domingo.
 * - Toda fecha es un `yyyy-mm-dd` local (Argentina, -03:00 fijo) y se compara
 *   como string. Nunca `new Date('yyyy-mm-dd')`: eso es medianoche UTC y en
 *   Argentina cae el día anterior.
 * - El estado de un día nunca se guarda: se calcula acá cada vez a partir de
 *   las fichadas, la versión de horario vigente ese día y la config general.
 *   Cambiar un horario no deja nada desactualizado.
 * - Quien no tiene horario vigente no recibe "tarde" ni "ausente": solo se
 *   muestra que fichó. Un número inventado en la pantalla que se usa para
 *   liquidar es peor que ningún número.
 */

import { FECHA_RE, OFFSET_RELOJ_MIN, sumarDias } from './asistencia-datos';

// ─── Tipos ──────────────────────────────────────────────────────────────────

/** 0 lunes … 6 domingo. */
export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const DIAS_SEMANA: readonly DiaSemana[] = [0, 1, 2, 3, 4, 5, 6];
export const DIAS_SEMANA_CORTO = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;
export const DIAS_SEMANA_LARGO = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const;

/** Jornada esperada de un día de la semana dentro de una versión de horario. */
export interface DiaHorario {
  /** Semanas del ciclo (0-based) en que aplica. Con ciclo 1 es siempre `[0]`. */
  semanas: number[];
  entrada: string; // HH:MM
  salida: string; // HH:MM, posterior a la entrada (sin turno nocturno)
  /**
   * Turnos rotativos: horas distintas por semana del ciclo (clave = semana
   * 0-based). Si una semana no figura, usa `entrada`/`salida`. Así dos personas
   * alternan mañana/tarde con el mismo ciclo y el ancla corrido una semana.
   */
  porSemana?: Partial<Record<number, { entrada: string; salida: string }>>;
}

/** Índice por día de la semana; día ausente = no laborable. */
export type DiasHorario = Partial<Record<DiaSemana, DiaHorario>>;

/** Una versión del horario de un empleado, vigente entre dos fechas. */
export interface HorarioVersion {
  id: number;
  empleadoId: number;
  vigenteDesde: string; // yyyy-mm-dd
  vigenteHasta: string | null; // yyyy-mm-dd inclusive; null = abierta
  incluir: boolean;
  cicloSemanas: number; // 1..CICLO_MAX
  cicloAncla: string; // lunes yyyy-mm-dd: "semana 1" del ciclo
  toleranciaMin: number | null; // null = usa la config general
  dias: DiasHorario;
}

/** Parámetros generales del control (singleton `AsistenciaConfig`). */
export interface ConfigAsistencia {
  toleranciaMin: number;
  tardeGraveMin: number;
}

export const CONFIG_DEFAULT: ConfigAsistencia = { toleranciaMin: 10, tardeGraveMin: 30 };

export const CICLO_MAX = 4;
export const TOLERANCIA_MAX = 180;

export const CICLO_LABELS: Record<number, string> = {
  1: 'Todas las semanas',
  2: 'Semanas alternas',
  3: 'Cada 3 semanas',
  4: 'Cada 4 semanas',
};

export type EstadoDia =
  | 'futuro'
  | 'pendiente'
  | 'sin_horario'
  | 'no_laborable'
  | 'trabajo_no_laborable'
  | 'a_horario'
  | 'tarde'
  | 'tarde_grave'
  | 'ausente'
  | 'feriado';

export const ESTADOS_DIA: Record<EstadoDia, { label: string; desc: string }> = {
  futuro: { label: 'Futuro', desc: 'Todavía no llegó ese día.' },
  pendiente: { label: 'Pendiente', desc: 'Es hoy y todavía no fichó.' },
  sin_horario: { label: 'Sin horario', desc: 'No hay horario vigente ese día: solo se muestra si fichó.' },
  no_laborable: { label: 'No laborable', desc: 'Día en que no se espera que venga.' },
  trabajo_no_laborable: { label: 'Trabajó en día no laborable', desc: 'Fichó un día que no tenía asignado.' },
  a_horario: { label: 'A horario', desc: 'Entró dentro de la tolerancia.' },
  tarde: { label: 'Tarde', desc: 'Entró después de la tolerancia.' },
  tarde_grave: { label: 'Tarde grave', desc: 'Entró con más minutos de atraso que el umbral general.' },
  ausente: { label: 'Ausente', desc: 'Tenía horario y no hay ninguna fichada.' },
  feriado: { label: 'Feriado', desc: 'Detectado: ese día fichó menos del 20 % de la gente con horario. Cuenta como no laborable; quien fichó tiene toda la jornada como extra al 100 %.' },
};

/**
 * Feriado detectado: un día laborable ya pasado en el que fichó menos de esta
 * fracción de las personas con jornada. No hay tabla de feriados: se infiere de
 * la asistencia real, como un domingo.
 */
export const FERIADO_UMBRAL = 0.2;
/** Con menos gente esperada que esto no se infiere nada (evita falsos feriados en equipos chicos). */
export const FERIADO_MIN_ESPERADOS = 5;

/** Una marca del día, ya filtrada por persona y fecha. */
export interface FichadaDia {
  fechaHora: string; // ISO UTC
  tipo: number; // 0 entrada, 1 salida, 2 descanso, 3 horas extra
}

export interface CeldaDia {
  fecha: string;
  estado: EstadoDia;
  /** Jornada esperada ese día, o null si no laborable / sin horario. */
  jornada: { entrada: string; salida: string } | null;
  entrada: string | null; // ISO de la marca tomada como entrada
  salida: string | null; // ISO de la marca tomada como salida
  minutosTarde: number | null;
  /**
   * `salida − entrada` en minutos cuando hay las dos marcas; null si falta
   * alguna. No descuenta descansos (tipo 2): es un bruto para comparar contra
   * la jornada esperada, no una liquidación de horas.
   */
  minutosTrabajados: number | null;
  /**
   * Horas extra derivadas (control contra el Excel de cada área, no una
   * liquidación): exceso después de la salida esperada, o toda la jornada en
   * un día no laborable. Null si falta entrada o salida. Ver `horasExtraDe`.
   */
  extra: HorasExtraDia | null;
  sinSalida: boolean;
  /** La entrada no vino de una marca de tipo Entrada (reloj sin tipos, etc.). */
  entradaInferida: boolean;
  marcas: number;
}

/** Exceso de un día partido en 50 % / 100 %, en minutos crudos y en horas completas. */
export interface HorasExtraDia {
  /**
   * Minutos de salida tardía que solo compensan la llegada tarde del mismo día:
   * llegar 1 h tarde e irse 1 h tarde no es hora extra. Se descuentan antes de
   * partir el exceso en 50 % / 100 %.
   */
  compensado: number;
  minutos50: number;
  minutos100: number;
  /** `Math.floor(minutos / HE_BLOQUE_MIN)`: una hora extra cuenta solo si está completa. */
  horas50: number;
  horas100: number;
}

/** Tamaño del bloque de hora extra: solo se cuentan bloques completos (60 = horas enteras). */
export const HE_BLOQUE_MIN = 60;
/** Sábado: hasta esta hora el exceso paga 50 %, después 100 %. Domingo paga 100 % todo el día. */
export const HE_SABADO_CORTE = '13:00';

export interface TotalesFila {
  laborables: number;
  aHorario: number;
  tarde: number;
  tardeGrave: number;
  ausente: number;
  trabajoNoLaborable: number;
  sinSalida: number;
  minutosTarde: number;
  conMarcas: number;
}

// ─── Fechas ─────────────────────────────────────────────────────────────────

const DIA_MS = 86_400_000;
const SEMANA_MS = 7 * DIA_MS;

function aMs(yyyymmdd: string): number {
  const [a, m, d] = yyyymmdd.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
}

function aIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Día de la semana con 0 = lunes. */
export function diaSemanaDe(fecha: string): DiaSemana {
  return ((new Date(aMs(fecha)).getUTCDay() + 6) % 7) as DiaSemana;
}

/** Lunes de la semana de `fecha` (la misma fecha si ya es lunes). */
export function lunesDe(fecha: string): string {
  return sumarDias(fecha, -diaSemanaDe(fecha));
}

/**
 * Semana del ciclo (0-based) a la que pertenece `fecha`, contando semanas
 * enteras desde el lunes del ancla. Nada de semanas ISO: la paridad se define
 * solo por la distancia al ancla, así "sábados de por medio" no depende del año.
 * Fechas anteriores al ancla dan módulo positivo (una semana antes de la
 * semana 0 de un ciclo de 2 es la semana 1).
 */
export function semanaDelCiclo(fecha: string, ancla: string, cicloSemanas: number): number {
  if (cicloSemanas <= 1) return 0;
  const semanas = Math.round((aMs(lunesDe(fecha)) - aMs(lunesDe(ancla))) / SEMANA_MS);
  return ((semanas % cicloSemanas) + cicloSemanas) % cicloSemanas;
}

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

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/** `2026-09` → `Septiembre 2026`. A mano, sin `Date`, por el huso. */
export function fmtMes(mes: string): string {
  if (!MES_RE.test(mes)) return mes;
  const [a, m] = mes.split('-').map(Number);
  return `${MESES[m - 1]} ${a}`;
}

/** Todos los días de un rango, inclusive. */
export function diasDelRango(desde: string, hasta: string): string[] {
  const out: string[] = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) out.push(f);
  return out;
}

// ─── Horas ──────────────────────────────────────────────────────────────────

export const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** `08:30` → 510. */
export function minutosDe(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Minuto del día local (Argentina) de un instante ISO UTC. */
export function minutoLocalDe(iso: string): number {
  const t = Date.parse(iso) + OFFSET_RELOJ_MIN * 60_000;
  return Math.floor((((t % DIA_MS) + DIA_MS) % DIA_MS) / 60_000);
}

// ─── Versiones ──────────────────────────────────────────────────────────────

/** Versión que aplica a `fecha`, o null. */
export function versionVigente(versiones: readonly HorarioVersion[], fecha: string): HorarioVersion | null {
  return versiones.find((v) => v.vigenteDesde <= fecha && (v.vigenteHasta == null || fecha <= v.vigenteHasta)) ?? null;
}

/** La versión de `vigenteDesde` más reciente (la única que se puede corregir o deshacer). */
export function ultimaVersion(versiones: readonly HorarioVersion[]): HorarioVersion | null {
  let ult: HorarioVersion | null = null;
  for (const v of versiones) if (!ult || v.vigenteDesde > ult.vigenteDesde) ult = v;
  return ult;
}

/** Jornada esperada de `fecha` según la versión, o null si no laborable / no incluido. */
export function jornadaDelDia(v: HorarioVersion, fecha: string): DiaHorario | null {
  if (!v.incluir) return null;
  const d = v.dias[diaSemanaDe(fecha)];
  if (!d) return null;
  if (v.cicloSemanas <= 1) return d;
  const sem = semanaDelCiclo(fecha, v.cicloAncla, v.cicloSemanas);
  if (!d.semanas.includes(sem)) return null;
  // Turno rotativo: la semana puede tener sus propias horas.
  const t = d.porSemana?.[sem];
  return t ? { ...d, entrada: t.entrada, salida: t.salida } : d;
}

/**
 * Próximas `n` ocurrencias de un día de la semana desde `desde`, con si la
 * versión las considera laborables. Es el preview del editor: "¿qué sábados
 * le tocan?" antes de guardar.
 */
export function proximasFechasDia(v: HorarioVersion, dia: DiaSemana, desde: string, n = 4): { fecha: string; aplica: boolean }[] {
  const out: { fecha: string; aplica: boolean }[] = [];
  let f = sumarDias(desde, (dia - diaSemanaDe(desde) + 7) % 7);
  for (let i = 0; i < n; i++, f = sumarDias(f, 7)) out.push({ fecha: f, aplica: jornadaDelDia(v, f) != null });
  return out;
}

// ─── Fichadas del día ───────────────────────────────────────────────────────

export interface ResumenFichadas {
  entrada: string | null;
  salida: string | null;
  entradaInferida: boolean;
  marcas: number;
}

/**
 * Entrada y salida de un día a partir de sus marcas. Mismo criterio que la vista
 * "por día" de Fichadas: entrada = primera marca de tipo Entrada (0); salida =
 * última de tipo Salida (1). Si no hubo marca de entrada, se toma la primera
 * marca que no sea salida y, en última instancia, la primera de todas (relojes
 * configurados sin tipos): en ambos casos `entradaInferida` lo dice. La salida
 * nunca se inventa: sin marca de tipo 1 queda en null.
 */
export function resumirFichadas(fichadas: readonly FichadaDia[]): ResumenFichadas {
  const orden = [...fichadas].sort((a, b) => (a.fechaHora < b.fechaHora ? -1 : a.fechaHora > b.fechaHora ? 1 : 0));
  let entrada: string | null = null;
  let noSalida: string | null = null;
  let salida: string | null = null;
  for (const f of orden) {
    if (f.tipo === 1) salida = f.fechaHora;
    else {
      if (f.tipo === 0 && entrada == null) entrada = f.fechaHora;
      if (noSalida == null) noSalida = f.fechaHora;
    }
  }
  const inferida = entrada == null;
  return { entrada: entrada ?? noSalida ?? orden[0]?.fechaHora ?? null, salida, entradaInferida: inferida && orden.length > 0, marcas: orden.length };
}

// ─── Estado del día ─────────────────────────────────────────────────────────

export interface EntradaEvaluacion {
  fecha: string;
  hoy: string;
  version: HorarioVersion | null;
  fichadas: readonly FichadaDia[];
  /** `NominaEmpleado.fecha_ingreso`: antes de esa fecha no se esperaba a la persona. */
  fechaIngreso?: string | null;
  /** Feriado detectado (`detectarFeriados`): se trata como domingo. */
  feriado?: boolean;
}

export function evaluarDia(e: EntradaEvaluacion, cfg: ConfigAsistencia): CeldaDia {
  const base: CeldaDia = {
    fecha: e.fecha,
    estado: 'futuro',
    jornada: null,
    entrada: null,
    salida: null,
    minutosTarde: null,
    minutosTrabajados: null,
    extra: null,
    sinSalida: false,
    entradaInferida: false,
    marcas: 0,
  };
  const antesDelIngreso = !!e.fechaIngreso && FECHA_RE.test(e.fechaIngreso) && e.fecha < e.fechaIngreso;
  const version = e.version != null && e.version.incluir && !antesDelIngreso ? e.version : null;
  // Un feriado detectado anula la jornada de ese día: nadie queda ausente y
  // quien fichó lo hizo en día no laborable (extra al 100 %).
  const esFeriado = !!e.feriado && e.fecha <= e.hoy;
  const jornada = version && !esFeriado ? jornadaDelDia(version, e.fecha) : null;

  // Futuro: sin estado, pero con la jornada planificada para que el calendario
  // muestre qué días le tocan (p. ej. qué sábados del ciclo).
  if (e.fecha > e.hoy) return jornada ? { ...base, jornada: { entrada: jornada.entrada, salida: jornada.salida } } : base;

  const r = resumirFichadas(e.fichadas);
  const conMarcas: CeldaDia = { ...base, entrada: r.entrada, salida: r.salida, entradaInferida: r.entradaInferida, marcas: r.marcas };
  if (r.entrada && r.salida && r.salida > r.entrada) conMarcas.minutosTrabajados = Math.round((Date.parse(r.salida) - Date.parse(r.entrada)) / 60_000);
  // Hoy la jornada sigue abierta: no es "sin salida" todavía.
  conMarcas.sinSalida = r.marcas > 0 && r.salida == null && e.fecha !== e.hoy;

  if (!version) return { ...conMarcas, estado: 'sin_horario' };
  if (!jornada) {
    if (r.marcas > 0 && r.entrada && r.salida) conMarcas.extra = horasExtraDe(e.fecha, minutoLocalDe(r.entrada), minutoLocalDe(r.salida), esFeriado);
    return { ...conMarcas, estado: r.marcas > 0 ? 'trabajo_no_laborable' : esFeriado ? 'feriado' : 'no_laborable' };
  }

  const conJornada: CeldaDia = { ...conMarcas, jornada: { entrada: jornada.entrada, salida: jornada.salida } };
  if (r.marcas === 0 || r.entrada == null) return { ...conJornada, estado: e.fecha === e.hoy ? 'pendiente' : 'ausente' };

  const tolerancia = version.toleranciaMin ?? cfg.toleranciaMin;
  const minutosTarde = Math.max(0, minutoLocalDe(r.entrada) - minutosDe(jornada.entrada));
  // Primero manda la tolerancia que aplique (propia si la tiene, si no la general):
  // dentro de ella es "a horario" aunque supere el umbral grave. Fuera de ella,
  // "grave" se mide desde la hora pactada, no desde el fin de la tolerancia:
  // con tolerancia 10 y umbral 30, entrar 08:31 a un turno de 08:00 es grave.
  const estado: EstadoDia = minutosTarde <= tolerancia ? 'a_horario' : minutosTarde >= cfg.tardeGraveMin ? 'tarde_grave' : 'tarde';
  // Solo la salida tardía cuenta como extra: llegar antes no (decisión de negocio).
  // Y primero compensa la llegada tarde del mismo día: solo el exceso neto es extra.
  let extra: HorasExtraDia | null = null;
  if (r.salida) {
    const salidaEsperada = minutosDe(jornada.salida);
    const salidaReal = minutoLocalDe(r.salida);
    const compensado = Math.min(minutosTarde, Math.max(0, salidaReal - salidaEsperada));
    extra = { ...horasExtraDe(e.fecha, salidaEsperada + compensado, salidaReal), compensado };
  }
  return { ...conJornada, estado, minutosTarde, extra };
}

/**
 * Exceso trabajado entre dos minutos del día (`desde` = salida esperada o
 * entrada real en día no laborable; `hasta` = salida real), partido en 50 % /
 * 100 % según el día: lunes a viernes 50 %; sábado 50 % hasta `HE_SABADO_CORTE`
 * y 100 % después; domingo y feriado (`todo100`) 100 %. Las horas se cuentan
 * enteras por tipo.
 */
export function horasExtraDe(fecha: string, desde: number, hasta: number, todo100 = false): HorasExtraDia {
  const out: HorasExtraDia = { compensado: 0, minutos50: 0, minutos100: 0, horas50: 0, horas100: 0 };
  if (hasta <= desde) return out;
  const ds = diaSemanaDe(fecha);
  if (ds === 6 || todo100) out.minutos100 = hasta - desde;
  else if (ds === 5) {
    const corte = minutosDe(HE_SABADO_CORTE);
    out.minutos50 = Math.max(0, Math.min(hasta, corte) - desde);
    out.minutos100 = Math.max(0, hasta - Math.max(desde, corte));
  } else out.minutos50 = hasta - desde;
  out.horas50 = Math.floor(out.minutos50 / HE_BLOQUE_MIN);
  out.horas100 = Math.floor(out.minutos100 / HE_BLOQUE_MIN);
  return out;
}

/** Minutos de la jornada esperada de una celda (0 si no laborable). */
export function minutosJornada(c: Pick<CeldaDia, 'jornada'>): number {
  return c.jornada ? minutosDe(c.jornada.salida) - minutosDe(c.jornada.entrada) : 0;
}

/** Resumen de un mes para liquidar: ausencias, tardanzas y horas contra lo esperado. */
export interface ResumenLiquidacion {
  /** Días con jornada ya transcurridos (hasta hoy inclusive, sin contar hoy si está pendiente). */
  laborables: number;
  /** Días con jornada en todo el mes, futuro incluido. */
  laborablesMes: number;
  ausentes: string[]; // fechas
  tardes: { fecha: string; minutos: number; grave: boolean }[];
  minutosTarde: number;
  trabajoNoLaborable: string[];
  /** Días con entrada pero sin salida: sus horas no se pueden contar. */
  sinSalida: string[];
  /** Días con marcas pero sin horario vigente (no se evalúan). */
  sinHorarioConMarcas: number;
  minutosEsperadosMes: number;
  minutosEsperadosHastaHoy: number;
  /** Suma de `minutosTrabajados` de los días con entrada y salida. */
  minutosTrabajados: number;
  diasComputados: number;
  /** Horas extra enteras del mes (control), y los días que aportan alguna. */
  horasExtra50: number;
  horasExtra100: number;
  diasConExtra: { fecha: string; horas50: number; horas100: number; minutos: number }[];
  /** Minutos de salida tardía que solo compensaron llegadas tarde (no son extra). */
  minutosCompensados: number;
  /** Feriados detectados en el mes (días en que casi nadie fichó). */
  feriados: string[];
}

export function resumenLiquidacion(celdas: readonly CeldaDia[]): ResumenLiquidacion {
  const r: ResumenLiquidacion = {
    laborables: 0, laborablesMes: 0, ausentes: [], tardes: [], minutosTarde: 0, trabajoNoLaborable: [], sinSalida: [],
    sinHorarioConMarcas: 0, minutosEsperadosMes: 0, minutosEsperadosHastaHoy: 0, minutosTrabajados: 0, diasComputados: 0,
    horasExtra50: 0, horasExtra100: 0, diasConExtra: [], minutosCompensados: 0, feriados: [],
  };
  for (const c of celdas) {
    const esperado = minutosJornada(c);
    if (c.jornada) {
      r.laborablesMes++;
      r.minutosEsperadosMes += esperado;
      if (c.estado !== 'futuro') {
        r.minutosEsperadosHastaHoy += esperado;
        if (c.estado !== 'pendiente') r.laborables++;
      }
    }
    if (c.estado === 'ausente') r.ausentes.push(c.fecha);
    if (c.estado === 'feriado') r.feriados.push(c.fecha);
    if (c.estado === 'tarde' || c.estado === 'tarde_grave') {
      r.tardes.push({ fecha: c.fecha, minutos: c.minutosTarde ?? 0, grave: c.estado === 'tarde_grave' });
      r.minutosTarde += c.minutosTarde ?? 0;
    }
    if (c.estado === 'trabajo_no_laborable') r.trabajoNoLaborable.push(c.fecha);
    if (c.sinSalida) r.sinSalida.push(c.fecha);
    if (c.estado === 'sin_horario' && c.marcas > 0) r.sinHorarioConMarcas++;
    if (c.minutosTrabajados != null) {
      r.minutosTrabajados += c.minutosTrabajados;
      r.diasComputados++;
    }
    if (c.extra) r.minutosCompensados += c.extra.compensado;
    if (c.extra && (c.extra.horas50 || c.extra.horas100)) {
      r.horasExtra50 += c.extra.horas50;
      r.horasExtra100 += c.extra.horas100;
      r.diasConExtra.push({ fecha: c.fecha, horas50: c.extra.horas50, horas100: c.extra.horas100, minutos: c.extra.minutos50 + c.extra.minutos100 });
    }
  }
  return r;
}

/** 510 → "8 h 30 min"; 0 → "0 h". */
export function fmtHorasMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function totalesDe(celdas: readonly CeldaDia[]): TotalesFila {
  const t: TotalesFila = { laborables: 0, aHorario: 0, tarde: 0, tardeGrave: 0, ausente: 0, trabajoNoLaborable: 0, sinSalida: 0, minutosTarde: 0, conMarcas: 0 };
  for (const c of celdas) {
    if (c.jornada && c.estado !== 'pendiente' && c.estado !== 'futuro') t.laborables++;
    if (c.marcas > 0) t.conMarcas++;
    if (c.sinSalida) t.sinSalida++;
    t.minutosTarde += c.minutosTarde ?? 0;
    switch (c.estado) {
      case 'a_horario': t.aHorario++; break;
      case 'tarde': t.tarde++; break;
      case 'tarde_grave': t.tardeGrave++; break;
      case 'ausente': t.ausente++; break;
      case 'trabajo_no_laborable': t.trabajoNoLaborable++; break;
    }
  }
  return t;
}

// ─── Calendario del mes ─────────────────────────────────────────────────────

export interface DiaCalendario {
  fecha: string;
  dia: number; // 1..31
  diaSemana: DiaSemana;
  esHoy: boolean;
  finDeSemana: boolean;
  /** Feriado detectado por baja asistencia (ver `detectarFeriados`). */
  feriado: boolean;
}

export interface FilaEntrada {
  versiones: readonly HorarioVersion[];
  fechaIngreso?: string | null;
  /** Fichadas del rango agrupadas por `fecha` local. */
  fichadasPorFecha: Record<string, FichadaDia[]>;
}

export interface FilaCalendario {
  celdas: CeldaDia[];
  totales: TotalesFila;
  /** Tiene alguna versión con `incluir` que toque el rango. */
  tieneHorario: boolean;
}

/**
 * Feriados inferidos de la asistencia real: un día laborable ya pasado (no hoy,
 * no sábado/domingo) en el que, de la gente con jornada ese día, fichó menos
 * de `FERIADO_UMBRAL`. Se calcula sobre toda la población con horario, no
 * sobre la fila que se está mirando.
 */
export function detectarFeriados(
  fechas: readonly string[],
  poblacion: readonly FilaEntrada[],
  hoy: string,
  opts: { umbral?: number; minimoEsperados?: number } = {},
): Set<string> {
  const umbral = opts.umbral ?? FERIADO_UMBRAL;
  const minimo = opts.minimoEsperados ?? FERIADO_MIN_ESPERADOS;
  const out = new Set<string>();
  for (const fecha of fechas) {
    if (fecha >= hoy || diaSemanaDe(fecha) >= 5) continue;
    let esperados = 0;
    let presentes = 0;
    for (const f of poblacion) {
      const v = versionVigente(f.versiones, fecha);
      if (!v || !v.incluir || (f.fechaIngreso && FECHA_RE.test(f.fechaIngreso) && fecha < f.fechaIngreso)) continue;
      if (!jornadaDelDia(v, fecha)) continue;
      esperados++;
      if ((f.fichadasPorFecha[fecha]?.length ?? 0) > 0) presentes++;
    }
    if (esperados >= minimo && presentes / esperados < umbral) out.add(fecha);
  }
  return out;
}

export function armarCalendario<T extends FilaEntrada>(
  p: { desde: string; hasta: string; hoy: string; cfg: ConfigAsistencia; filas: readonly T[]; feriados?: ReadonlySet<string> },
): { dias: DiaCalendario[]; filas: (Omit<T, keyof FilaEntrada> & FilaCalendario)[] } {
  const fechas = diasDelRango(p.desde, p.hasta);
  const feriados = p.feriados ?? new Set<string>();
  const dias = fechas.map<DiaCalendario>((fecha) => {
    const ds = diaSemanaDe(fecha);
    return { fecha, dia: Number(fecha.slice(8, 10)), diaSemana: ds, esHoy: fecha === p.hoy, finDeSemana: ds >= 5, feriado: feriados.has(fecha) };
  });
  const filas = p.filas.map((fila) => {
    const { versiones, fechaIngreso, fichadasPorFecha, ...resto } = fila;
    const celdas = fechas.map((fecha) =>
      evaluarDia({ fecha, hoy: p.hoy, version: versionVigente(versiones, fecha), fichadas: fichadasPorFecha[fecha] ?? [], fechaIngreso, feriado: feriados.has(fecha) }, p.cfg),
    );
    const tieneHorario = versiones.some((v) => v.incluir && v.vigenteDesde <= p.hasta && (v.vigenteHasta == null || v.vigenteHasta >= p.desde));
    return { ...(resto as Omit<T, keyof FilaEntrada>), celdas, totales: totalesDe(celdas), tieneHorario };
  });
  return { dias, filas };
}

// ─── Validación del editor ──────────────────────────────────────────────────

export interface HorarioInput {
  empleadoId: number;
  aplicarDesde: string;
  incluir: boolean;
  cicloSemanas: number;
  cicloAncla: string;
  toleranciaMin: number | null;
  dias: DiasHorario;
  /**
   * Última versión que vio el editor (null = "no había ninguna"); si cambió, el
   * server rechaza con 409. `undefined` = no verificar (seed, migración).
   */
  versionEsperadaId?: number | null;
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Valida y normaliza lo que manda el editor. Mismo código en cliente (para
 * avisar antes de enviar) y servidor (la API lo envuelve en un 400). Lanza
 * `Error` con un mensaje para mostrar tal cual.
 */
export function validarHorarioInput(raw: unknown): HorarioInput {
  if (!esObjeto(raw)) throw new Error('Datos del horario inválidos');
  const empleadoId = Number(raw.empleadoId);
  if (!Number.isInteger(empleadoId) || empleadoId <= 0) throw new Error('Falta el empleado');
  const aplicarDesde = String(raw.aplicarDesde ?? '');
  if (!FECHA_RE.test(aplicarDesde)) throw new Error('Indicá desde qué fecha aplica el horario');
  const incluir = raw.incluir !== false;
  const cicloSemanas = Number(raw.cicloSemanas ?? 1);
  if (!Number.isInteger(cicloSemanas) || cicloSemanas < 1 || cicloSemanas > CICLO_MAX) throw new Error(`El ciclo tiene que ser de 1 a ${CICLO_MAX} semanas`);
  let cicloAncla = String(raw.cicloAncla ?? '');
  if (cicloSemanas > 1) {
    if (!FECHA_RE.test(cicloAncla)) throw new Error('Indicá en qué semana empieza el ciclo');
    cicloAncla = lunesDe(cicloAncla);
  } else {
    cicloAncla = FECHA_RE.test(cicloAncla) ? lunesDe(cicloAncla) : lunesDe(aplicarDesde);
  }
  let toleranciaMin: number | null = null;
  if (raw.toleranciaMin != null && raw.toleranciaMin !== '') {
    toleranciaMin = Number(raw.toleranciaMin);
    if (!Number.isInteger(toleranciaMin) || toleranciaMin < 0 || toleranciaMin > TOLERANCIA_MAX) throw new Error(`La tolerancia va de 0 a ${TOLERANCIA_MAX} minutos`);
  }
  const versionEsperadaId = raw.versionEsperadaId === undefined ? undefined : raw.versionEsperadaId === null ? null : Number(raw.versionEsperadaId);
  if (versionEsperadaId != null && (!Number.isInteger(versionEsperadaId) || versionEsperadaId <= 0)) throw new Error('Versión esperada inválida');

  const dias: DiasHorario = {};
  const rawDias = esObjeto(raw.dias) ? raw.dias : {};
  for (const ds of DIAS_SEMANA) {
    const d = rawDias[String(ds)];
    if (d == null) continue;
    const nombre = DIAS_SEMANA_LARGO[ds];
    if (!esObjeto(d)) throw new Error(`Horario del ${nombre.toLowerCase()} inválido`);
    const entrada = String(d.entrada ?? '');
    const salida = String(d.salida ?? '');
    if (!HORA_RE.test(entrada) || !HORA_RE.test(salida)) throw new Error(`Cargá entrada y salida del ${nombre.toLowerCase()} como HH:MM`);
    if (minutosDe(salida) <= minutosDe(entrada)) throw new Error(`${nombre}: la salida tiene que ser posterior a la entrada (no hay turnos nocturnos)`);
    let semanas: number[];
    let porSemana: DiaHorario['porSemana'];
    if (cicloSemanas === 1) semanas = [0];
    else {
      const s = Array.isArray(d.semanas) ? d.semanas.map(Number) : [];
      semanas = [...new Set(s)].filter((n) => Number.isInteger(n) && n >= 0 && n < cicloSemanas).sort((a, b) => a - b);
      if (semanas.length === 0) throw new Error(`${nombre}: elegí al menos una semana del ciclo`);
      // Turnos rotativos: horas propias por semana (solo las semanas en que viene).
      if (esObjeto(d.porSemana)) {
        for (const sem of semanas) {
          const t = d.porSemana[String(sem)];
          if (t == null) continue;
          if (!esObjeto(t)) throw new Error(`${nombre}, semana ${sem + 1}: horario inválido`);
          const te = String(t.entrada ?? '');
          const tsal = String(t.salida ?? '');
          if (!HORA_RE.test(te) || !HORA_RE.test(tsal)) throw new Error(`${nombre}, semana ${sem + 1}: cargá entrada y salida como HH:MM`);
          if (minutosDe(tsal) <= minutosDe(te)) throw new Error(`${nombre}, semana ${sem + 1}: la salida tiene que ser posterior a la entrada`);
          if (te === entrada && tsal === salida) continue; // igual al default: no hace falta guardarlo
          (porSemana ??= {})[sem] = { entrada: te, salida: tsal };
        }
      }
    }
    dias[ds] = porSemana ? { semanas, entrada, salida, porSemana } : { semanas, entrada, salida };
  }
  if (incluir && Object.keys(dias).length === 0) throw new Error('Marcá al menos un día laborable');

  return { empleadoId, aplicarDesde, incluir, cicloSemanas, cicloAncla, toleranciaMin, dias, versionEsperadaId };
}

/** Valida los parámetros generales. */
export function validarConfigInput(raw: unknown): ConfigAsistencia {
  if (!esObjeto(raw)) throw new Error('Parámetros inválidos');
  const toleranciaMin = Number(raw.toleranciaMin);
  const tardeGraveMin = Number(raw.tardeGraveMin);
  if (!Number.isInteger(toleranciaMin) || toleranciaMin < 0 || toleranciaMin > TOLERANCIA_MAX) throw new Error(`La tolerancia va de 0 a ${TOLERANCIA_MAX} minutos`);
  if (!Number.isInteger(tardeGraveMin) || tardeGraveMin < 1 || tardeGraveMin > 600) throw new Error('El umbral de tarde grave va de 1 a 600 minutos');
  if (tardeGraveMin <= toleranciaMin) throw new Error('El umbral de tarde grave tiene que superar la tolerancia');
  return { toleranciaMin, tardeGraveMin };
}

// ─── Descripción en una línea ───────────────────────────────────────────────

/** `[0,1,2,4]` → "L–X, V": las rachas de 3 o más se comprimen con guion. */
function etiquetaDias(dias: DiaSemana[]): string {
  const partes: string[] = [];
  for (let i = 0; i < dias.length; ) {
    let j = i;
    while (j + 1 < dias.length && dias[j + 1] === dias[j] + 1) j++;
    if (j - i >= 2) partes.push(`${DIAS_SEMANA_CORTO[dias[i]]}–${DIAS_SEMANA_CORTO[dias[j]]}`);
    else for (let k = i; k <= j; k++) partes.push(DIAS_SEMANA_CORTO[dias[k]]);
    i = j + 1;
  }
  return partes.join(', ');
}

/** "L–V 08:00–17:00 · S 09:00–13:00 (S1) · semanas alternas". */
export function describirHorario(v: Pick<HorarioVersion, 'incluir' | 'cicloSemanas' | 'dias'>): string {
  if (!v.incluir) return 'No incluido en el control';
  type Seg = { dias: DiaSemana[]; clave: string; d: DiaHorario };
  const segs: Seg[] = [];
  for (const ds of DIAS_SEMANA) {
    const d = v.dias[ds];
    if (!d) continue;
    // Se agrupa por jornada igual (horas y semanas), no por días seguidos: "L, X, V 08:00–12:00".
    const clave = `${d.entrada}|${d.salida}|${d.semanas.join(',')}|${JSON.stringify(d.porSemana ?? null)}`;
    const seg = segs.find((s) => s.clave === clave);
    if (seg) seg.dias.push(ds);
    else segs.push({ dias: [ds], clave, d });
  }
  if (segs.length === 0) return 'Sin días laborables';
  const partes = segs.map((s) => {
    const ps = s.d.porSemana;
    if (v.cicloSemanas > 1 && ps && Object.keys(ps).length > 0) {
      // Rotativo: una hora por semana. "L–V S1 06:00–14:00, S2 14:00–22:00".
      const porSem = s.d.semanas.map((n) => {
        const t = ps[n] ?? s.d;
        return `S${n + 1} ${t.entrada}–${t.salida}`;
      });
      return `${etiquetaDias(s.dias)} ${porSem.join(', ')}`;
    }
    const sem = v.cicloSemanas > 1 && s.d.semanas.length < v.cicloSemanas ? ` (${s.d.semanas.map((n) => `S${n + 1}`).join(', ')})` : '';
    return `${etiquetaDias(s.dias)} ${s.d.entrada}–${s.d.salida}${sem}`;
  });
  if (v.cicloSemanas > 1) partes.push((CICLO_LABELS[v.cicloSemanas] ?? `ciclo de ${v.cicloSemanas} semanas`).toLowerCase());
  return partes.join(' · ');
}

/** Horario por defecto del editor cuando el empleado no tiene ninguno. */
export function diasPorDefecto(): DiasHorario {
  const d: DiasHorario = {};
  for (const ds of [0, 1, 2, 3, 4] as DiaSemana[]) d[ds] = { semanas: [0], entrada: '08:00', salida: '17:00' };
  return d;
}
