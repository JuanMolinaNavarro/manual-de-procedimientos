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
  | 'ausente';

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
};

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
  sinSalida: boolean;
  /** La entrada no vino de una marca de tipo Entrada (reloj sin tipos, etc.). */
  entradaInferida: boolean;
  marcas: number;
}

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
  if (v.cicloSemanas > 1 && !d.semanas.includes(semanaDelCiclo(fecha, v.cicloAncla, v.cicloSemanas))) return null;
  return d;
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
}

export function evaluarDia(e: EntradaEvaluacion, cfg: ConfigAsistencia): CeldaDia {
  const base: CeldaDia = {
    fecha: e.fecha,
    estado: 'futuro',
    jornada: null,
    entrada: null,
    salida: null,
    minutosTarde: null,
    sinSalida: false,
    entradaInferida: false,
    marcas: 0,
  };
  const antesDelIngreso = !!e.fechaIngreso && FECHA_RE.test(e.fechaIngreso) && e.fecha < e.fechaIngreso;
  const version = e.version != null && e.version.incluir && !antesDelIngreso ? e.version : null;
  const jornada = version ? jornadaDelDia(version, e.fecha) : null;

  // Futuro: sin estado, pero con la jornada planificada para que el calendario
  // muestre qué días le tocan (p. ej. qué sábados del ciclo).
  if (e.fecha > e.hoy) return jornada ? { ...base, jornada: { entrada: jornada.entrada, salida: jornada.salida } } : base;

  const r = resumirFichadas(e.fichadas);
  const conMarcas: CeldaDia = { ...base, entrada: r.entrada, salida: r.salida, entradaInferida: r.entradaInferida, marcas: r.marcas };
  // Hoy la jornada sigue abierta: no es "sin salida" todavía.
  conMarcas.sinSalida = r.marcas > 0 && r.salida == null && e.fecha !== e.hoy;

  if (!version) return { ...conMarcas, estado: 'sin_horario' };
  if (!jornada) return { ...conMarcas, estado: r.marcas > 0 ? 'trabajo_no_laborable' : 'no_laborable' };

  const conJornada: CeldaDia = { ...conMarcas, jornada: { entrada: jornada.entrada, salida: jornada.salida } };
  if (r.marcas === 0 || r.entrada == null) return { ...conJornada, estado: e.fecha === e.hoy ? 'pendiente' : 'ausente' };

  const tolerancia = version.toleranciaMin ?? cfg.toleranciaMin;
  const minutosTarde = Math.max(0, minutoLocalDe(r.entrada) - minutosDe(jornada.entrada));
  // "Grave" se mide desde la hora pactada, no desde el fin de la tolerancia:
  // con tolerancia 10 y umbral 30, entrar 08:31 a un turno de 08:00 es grave.
  const estado: EstadoDia = minutosTarde >= cfg.tardeGraveMin ? 'tarde_grave' : minutosTarde > tolerancia ? 'tarde' : 'a_horario';
  return { ...conJornada, estado, minutosTarde };
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

export function armarCalendario<T extends FilaEntrada>(
  p: { desde: string; hasta: string; hoy: string; cfg: ConfigAsistencia; filas: readonly T[] },
): { dias: DiaCalendario[]; filas: (Omit<T, keyof FilaEntrada> & FilaCalendario)[] } {
  const fechas = diasDelRango(p.desde, p.hasta);
  const dias = fechas.map<DiaCalendario>((fecha) => {
    const ds = diaSemanaDe(fecha);
    return { fecha, dia: Number(fecha.slice(8, 10)), diaSemana: ds, esHoy: fecha === p.hoy, finDeSemana: ds >= 5 };
  });
  const filas = p.filas.map((fila) => {
    const { versiones, fechaIngreso, fichadasPorFecha, ...resto } = fila;
    const celdas = fechas.map((fecha) =>
      evaluarDia({ fecha, hoy: p.hoy, version: versionVigente(versiones, fecha), fichadas: fichadasPorFecha[fecha] ?? [], fechaIngreso }, p.cfg),
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
    if (cicloSemanas === 1) semanas = [0];
    else {
      const s = Array.isArray(d.semanas) ? d.semanas.map(Number) : [];
      semanas = [...new Set(s)].filter((n) => Number.isInteger(n) && n >= 0 && n < cicloSemanas).sort((a, b) => a - b);
      if (semanas.length === 0) throw new Error(`${nombre}: elegí al menos una semana del ciclo`);
    }
    dias[ds] = { semanas, entrada, salida };
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
    const clave = `${d.entrada}|${d.salida}|${d.semanas.join(',')}`;
    const seg = segs.find((s) => s.clave === clave);
    if (seg) seg.dias.push(ds);
    else segs.push({ dias: [ds], clave, d });
  }
  if (segs.length === 0) return 'Sin días laborables';
  const partes = segs.map((s) => {
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
