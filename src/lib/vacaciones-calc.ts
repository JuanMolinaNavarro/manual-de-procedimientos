/**
 * Vacaciones: motor puro (cliente y servidor), portado del prototipo VacationDesk.
 *
 * Marco legal: LCT arts. 150 a 157, 162 y 164 (texto original) y art. 154 según el art. 41 de la
 * Ley 27.802 (BO 06/03/2026; rige desde que la Cámara del Trabajo, Sala VIII, dejó sin efecto la
 * cautelar de la CGT el 23/04/2026):
 * - se otorgan entre el 1/10 y el 30/4 del año siguiente; fuera de ese período, solo de mutuo acuerdo;
 * - la fecha de inicio se notifica por escrito con 30 días o más (el convenio puede fijar otro sistema);
 * - empleador y trabajador pueden fraccionarlas en tramos de 7 días o más;
 * - si no salen todos juntos, cada uno tiene verano al menos una vez cada 3 años;
 * - una enfermedad informada en tiempo (con posibilidad de control) las interrumpe: vuelve al final
 *   del período previsto (o al alta, art. 208) y el saldo no gozado se reprograma.
 * Los valores de los convenios (CCT 223/75, 130/75) vienen del prototipo: validarlos con Legales.
 *
 * Todo trabaja sobre un `EstadoVac` (foto de la temporada) y NUNCA lo muta: las acciones devuelven
 * la solicitud nueva. El servidor revalida cada acción con estas mismas funciones antes de guardar.
 */

import { DIA_MS, FECHA_RE, aMs, sumarDias } from './asistencia-datos';
import { lunesDe } from './asistencia-calendario';

// ─── Tipos ──────────────────────────────────────────────────────────────────

/** `portal`: versión para la persona (Mis vacaciones), sin datos de otras personas ni jerga de RR.HH. */
export interface Flag { tipo: 'error' | 'warn'; msg: string; portal?: string }
export const paraPortal = (f: Flag): Flag => ({ tipo: f.tipo, msg: f.portal ?? f.msg });
export const TEXTO_PORTAL = {
  sinIngreso: 'Todavía no podemos calcular tus días porque falta tu fecha de ingreso. Avisale a RR.HH.',
  noParticipa: 'Este año no figurás en la planificación de vacaciones. Consultalo con RR.HH.',
};

export interface Convenio {
  nombre: string;
  /** Corte de la antigüedad: día/mes del año del ejercicio + `corteAnioOffset`. */
  corteDia: number;
  corteMes: number;
  corteAnioOffset: number;
  maxTramos: number;
  avisoDias: number;
  conyuges: boolean;
  permutas: boolean;
  suspFallecimiento: boolean;
  hijosEscolares: boolean;
  remuneracion: 'actual' | 'mayor12';
}

export interface Cierre { nombre: string; desde: string; hasta: string }

export const CRITERIOS_ORDEN = {
  rotacion: 'Rotación anual + antigüedad + sorteo',
  antiguedad: 'Antigüedad + sorteo',
  sorteo: 'Sorteo',
  llegada: 'Por orden de llegada (sin turnos)',
} as const;
export type CriterioOrden = keyof typeof CRITERIOS_ORDEN;

export interface ConfigVacaciones {
  ejercicio: number;
  temporadaDesde: string;
  temporadaHasta: string;
  /** La ley no define el verano: lo fija la empresa (MM-DD). */
  veranoInicio: string;
  veranoFin: string;
  cicloVerano: number;
  avisoMinimoDias: number;
  inicioProceso: string;
  fechaLimiteCarga: string;
  criterioOrden: CriterioOrden;
  personasPorTurno: number;
  diasPorTurno: number;
  semillaSorteo: string;
  fraccionar: boolean;
  tramoMinimo: number;
  maxTramos: number;
  tramoPrincipalPct: number;
  feriados: string[];
  cierres: Cierre[];
  convenios: Record<string, Convenio>;
}

/** Persona del organigrama con lo que vacaciones necesita de Nómina (ingreso, categoría, básico). */
export interface EmpleadoVac {
  id: number;
  nombre: string;
  rol: string;
  area: string;
  areaId: number | null;
  organigramaId: number | null;
  organigrama: string;
  fotoArchivo: string | null;
  /** Texto del convenio de la ficha ("Satsaid 223/75 · GRUPO 3", "Fuera de Convenio"). */
  convenioTexto: string;
  fechaIngreso: string;
  categoria: string;
  basico: number;
}

export interface HistorialTemporada { verano: boolean | null; pos: number | null }

export interface PerfilVac {
  incluir: boolean;
  /** Código que pisa el convenio automático; null = auto. */
  convenio: string | null;
  francoRotativo: boolean;
  /** Día de descanso semanal con francos rotativos: 0 = domingo … 6 = sábado. */
  diaDescanso: number;
  /** Días trabajados del ejercicio (art. 151/153); null = estimado desde el ingreso. */
  diasTrabajados: number | null;
  extraConvenio: number;
  extraBeneficio: number;
  arrastre: { dias: number; acuerdo: boolean; origen: number | null };
  remuneracionRef: number | null;
  conyugeId: number | null;
  hijosPrimaria: boolean;
  /** Por ejercicio: si tuvo verano y en qué turno eligió. */
  historial: Record<string, HistorialTemporada>;
}

export interface ReglaCobertura {
  tipo: 'noJuntos' | 'minimo';
  nombre: string;
  ids: number[];
  min?: number;
  /** La de "jefe y segundo", que se arma sola desde el área. */
  auto?: boolean;
}

export interface AreaVac {
  id: number;
  nombre: string;
  organigramaId: number | null;
  color: string;
  /** Jefe del área en el organigrama (solo lectura acá). */
  jefeId: number | null;
  segundoId: number | null;
  /** Personas afuera a la vez; null = sin límite. */
  cupo: number | null;
  /** Lunes → cupo propio de esa semana (0 = cerrada). */
  semanas: Record<string, number>;
  reglas: ReglaCobertura[];
  nota: string;
}

export interface Tramo {
  desde: string;
  hasta: string;
  dias: number;
  /** Acuerdo de goce fuera del 1/10–30/4 (art. 154). */
  fueraTemp?: { fecha: string; por: string } | null;
  reprog?: boolean;
  estadoTramo?: 'pendiente' | 'aprobado';
}

export const MOTIVOS_INTERRUPCION = {
  enfermedad: 'Enfermedad informada en tiempo',
  fallecimiento: 'Fallecimiento de un familiar directo',
  otro: 'Otro (acuerdo de partes)',
} as const;
export type MotivoInterrupcion = keyof typeof MOTIVOS_INTERRUPCION;

export interface Interrupcion {
  tramoDesde: string;
  /** Días no gozados dentro del tramo (inclusive). */
  desde: string;
  hasta: string;
  motivo: MotivoInterrupcion;
  certificado: string;
  noGozados: number;
  registrada: string;
  por: string;
}

export type EstadoSolicitud = 'borrador' | 'enviada' | 'aprobada' | 'rechazada';

export interface Solicitud {
  tramos: Tramo[];
  estado: EstadoSolicitud;
  enviada: string | null;
  motivo: string;
  acuerdoFracc: { fecha: string; tramos: string; por: string; canal: 'portal' | 'papel' } | null;
  notificacion: { fecha: string; aviso: number; por: string; acuse: string | null; acusePor: string | null } | null;
  interrupciones: Interrupcion[];
  autorizaFueraTermino: boolean;
}

/** Foto de la temporada: todo lo que el motor necesita, sin base de datos. */
export interface EstadoVac {
  hoy: string;
  config: ConfigVacaciones;
  empleados: EmpleadoVac[];
  perfiles: Record<number, Partial<PerfilVac>>;
  areas: Record<number, AreaVac>;
  solicitudes: Record<number, Solicitud>;
}

// ─── Constantes y defaults ──────────────────────────────────────────────────

/** Art. 155 a): sueldo mensual ÷ 25. */
const DIVISOR_VALOR_DIA = 25;
/** Tope de un tramo de vacaciones (35 días de ley + extras con holgura). */
export const MAX_DIAS_TRAMO = 60;
/** Art. 164: se acumula hasta la tercera parte del período anterior, con acuerdo. */
const FRACCION_ARRASTRE = 3;
export const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] as const;
export const MMDD_RE = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const CONVENIOS_DEFAULT: Record<string, Convenio> = {
  LCT: {
    nombre: 'Fuera de convenio (LCT)', corteDia: 31, corteMes: 12, corteAnioOffset: 0, maxTramos: 3, avisoDias: 30,
    conyuges: false, permutas: false, suspFallecimiento: false, hijosEscolares: false, remuneracion: 'actual',
  },
  CCT223: {
    nombre: 'CCT 223/75 · SATSAID (TV por cable)', corteDia: 31, corteMes: 3, corteAnioOffset: 1, maxTramos: 2, avisoDias: 30,
    conyuges: true, permutas: true, suspFallecimiento: true, hijosEscolares: false, remuneracion: 'mayor12',
  },
  CCT130: {
    nombre: 'CCT 130/75 · Comercio', corteDia: 31, corteMes: 12, corteAnioOffset: 0, maxTramos: 3, avisoDias: 60,
    conyuges: true, permutas: false, suspFallecimiento: false, hijosEscolares: true, remuneracion: 'actual',
  },
};

export const CONFIG_DEFAULT: ConfigVacaciones = {
  ejercicio: 2026,
  temporadaDesde: '2026-10-01',
  temporadaHasta: '2027-04-30',
  veranoInicio: '12-01',
  veranoFin: '02-28',
  cicloVerano: 3,
  avisoMinimoDias: 30,
  inicioProceso: '2026-09-28',
  fechaLimiteCarga: '2026-10-16',
  criterioOrden: 'rotacion',
  personasPorTurno: 3,
  diasPorTurno: 2,
  semillaSorteo: '2026',
  fraccionar: true,
  tramoMinimo: 7,
  maxTramos: 3,
  tramoPrincipalPct: 50,
  // Feriados nacionales de la temporada 2026/27 (Ley 27.399; el 20/11 se traslada al lunes 23).
  // Los "días no laborables" (Jueves Santo, puentes turísticos) son optativos: no van.
  feriados: [
    '2026-10-12', '2026-11-23', '2026-12-08', '2026-12-25', '2027-01-01',
    '2027-02-08', '2027-02-09', '2027-03-24', '2027-03-26', '2027-04-02',
  ],
  cierres: [],
  convenios: CONVENIOS_DEFAULT,
};

const PERFIL_DEFAULT: PerfilVac = {
  incluir: true, convenio: null, francoRotativo: false, diaDescanso: 0, diasTrabajados: null,
  extraConvenio: 0, extraBeneficio: 0, arrastre: { dias: 0, acuerdo: false, origen: null },
  remuneracionRef: null, conyugeId: null, hijosPrimaria: false, historial: {},
};

export function solVacia(): Solicitud {
  return {
    tramos: [], estado: 'borrador', enviada: null, motivo: '', acuerdoFracc: null,
    notificacion: null, interrupciones: [], autorizaFueraTermino: false,
  };
}

/** Config guardada (parcial, de la base) sobre los defaults. */
export function mezclarConfig(guardada: unknown): ConfigVacaciones {
  const g = (guardada && typeof guardada === 'object' ? guardada : {}) as Partial<ConfigVacaciones>;
  return { ...CONFIG_DEFAULT, ...g, convenios: { ...CONVENIOS_DEFAULT, ...(g.convenios ?? {}) } };
}

// ─── Memo por foto (el estado nunca se muta, así que cachear por objeto es seguro) ──

const memos = new WeakMap<EstadoVac, Map<string, unknown>>();
function memo<T>(E: EstadoVac, clave: string, fn: () => T): T {
  let m = memos.get(E);
  if (!m) memos.set(E, (m = new Map()));
  if (!m.has(clave)) m.set(clave, fn());
  return m.get(clave) as T;
}

// ─── Fechas (yyyy-mm-dd en UTC, como el resto del panel) ────────────────────

const pad2 = (n: number) => String(n).padStart(2, '0');
const dow = (f: string) => new Date(aMs(f)).getUTCDay();
const esBisiesto = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export const diffDias = (a: string, b: string) => Math.round((aMs(b) - aMs(a)) / DIA_MS);

function addYears(f: string, n: number): string {
  const y = +f.slice(0, 4) + n;
  const md = f.slice(5);
  return `${y}-${md === '02-29' && !esBisiesto(y) ? '02-28' : md}`;
}

export function fmtD(f: string | null | undefined): string {
  return f ? `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}` : '—';
}

const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const fmtCorto = (f: string) => `${+f.slice(8, 10)} ${MESES_CORTO[+f.slice(5, 7) - 1]}`;
const fmtMmdd = (md: string) => md.split('-').reverse().join('/');

export const esFeriado = (E: EstadoVac, f: string) => E.config.feriados.includes(f);
function esHabil(E: EstadoVac, f: string): boolean {
  const w = dow(f);
  return w !== 0 && w !== 6 && !esFeriado(E, f);
}

function habilesEntre(E: EstadoVac, a: string, b: string): number {
  return memo(E, `hab:${a}:${b}`, () => {
    let n = 0;
    for (let f = a; f <= b; f = sumarDias(f, 1)) if (esHabil(E, f)) n++;
    return n;
  });
}

function habilAnterior(E: EstadoVac, f: string): string {
  let d = sumarDias(f, -1);
  for (let g = 0; g < 15 && !esHabil(E, d); g++) d = sumarDias(d, -1);
  return d;
}

export function semanasDeRango(desde: string, hasta: string): string[] {
  const out: string[] = [];
  for (let w = lunesDe(desde); w <= hasta; w = sumarDias(w, 7)) out.push(w);
  return out;
}

export const semanasTemporada = (E: EstadoVac) =>
  memo(E, 'semanas', () => semanasDeRango(E.config.temporadaDesde, E.config.temporadaHasta));

export const solapan = (a1: string, a2: string, b1: string, b2: string) => a1 <= b2 && a2 >= b1;

/** Rango del verano de la empresa (MM-DD); el portal lo recibe sin el resto de la foto. */
export type RangoVerano = Pick<ConfigVacaciones, 'veranoInicio' | 'veranoFin'>;

function esVerano(c: RangoVerano, f: string): boolean {
  const md = f.slice(5), { veranoInicio: i, veranoFin: z } = c;
  return i <= z ? md >= i && md <= z : md >= i || md <= z;
}

export function rangoTocaVerano(c: RangoVerano, desde: string, hasta: string): boolean {
  for (let f = desde, g = 0; f <= hasta && g < 400; f = sumarDias(f, 1), g++) if (esVerano(c, f)) return true;
  return false;
}


/** FNV-1a: sorteo reproducible a partir de la semilla (queda registrada para auditar). */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ─── Personas ───────────────────────────────────────────────────────────────

export function empById(E: EstadoVac, id: number): EmpleadoVac | null {
  return memo(E, 'idx', () => new Map(E.empleados.map((e) => [e.id, e] as const))).get(id) ?? null;
}
export const nombreDe = (E: EstadoVac, id: number | null | undefined) => (id != null && empById(E, id)?.nombre) || '—';

export function perfilDe(E: EstadoVac, id: number): PerfilVac {
  return memo(E, `p:${id}`, () => ({ ...PERFIL_DEFAULT, ...E.perfiles[id] }));
}

export function incluidos(E: EstadoVac): EmpleadoVac[] {
  return memo(E, 'inc', () => E.empleados.filter((e) => perfilDe(E, e.id).incluir));
}

/** Convenio a partir del texto de la ficha (lo que trae Finnegans). */
export function convenioAuto(texto: string | null | undefined): string {
  const t = (texto ?? '').toLowerCase();
  if (/223\s*\/\s*75/.test(t) || t.includes('satsaid')) return 'CCT223';
  if (/130\s*\/\s*75/.test(t) || t.includes('comercio')) return 'CCT130';
  return 'LCT';
}

export function convenioCodigo(E: EstadoVac, id: number): string {
  const p = perfilDe(E, id);
  if (p.convenio && existeConvenio(E, p.convenio)) return p.convenio;
  const auto = convenioAuto(empById(E, id)?.convenioTexto);
  // LCT siempre está: `mezclarConfig` lo trae de los defaults y la API no deja quitarlo.
  return existeConvenio(E, auto) ? auto : 'LCT';
}

/** `hasOwn` y no `in`: un código como «constructor» no es un convenio. */
export const existeConvenio = (E: EstadoVac, codigo: string) => Object.hasOwn(E.config.convenios, codigo);

export function convenioDe(E: EstadoVac, id: number): Convenio & { codigo: string } {
  const codigo = convenioCodigo(E, id);
  return { codigo, ...E.config.convenios[codigo] };
}

// ─── Días que corresponden (arts. 150, 151, 153 y 164) ──────────────────────

export function fechaCorte(E: EstadoVac, id: number, ej = E.config.ejercicio): string {
  const c = convenioDe(E, id);
  return `${ej + c.corteAnioOffset}-${pad2(c.corteMes)}-${pad2(c.corteDia)}`;
}

/** Años cumplidos al corte (para mostrar); null sin fecha de ingreso. */
function aniosAl(E: EstadoVac, id: number, ej = E.config.ejercicio): number | null {
  const ing = empById(E, id)?.fechaIngreso ?? '';
  if (!FECHA_RE.test(ing)) return null;
  const fc = fechaCorte(E, id, ej);
  let y = +fc.slice(0, 4) - +ing.slice(0, 4);
  if (fc.slice(5) < ing.slice(5)) y--;
  return Math.max(0, y);
}

/**
 * Art. 150: 14 días si la antigüedad al corte "no excede" de 5 años, 21 si excede de 5, 28 si
 * excede de 10 y 35 si excede de 20. "Exceder" es estricto: con 5 años justos al corte son 14.
 */
export function diasPorAntiguedad(ingreso: string, corte: string): number {
  const supera = (n: number) => addYears(ingreso, n) < corte;
  return supera(20) ? 35 : supera(10) ? 28 : supera(5) ? 21 : 14;
}

function trabajadosEstimados(E: EstadoVac, id: number, ej: number): number {
  const p = perfilDe(E, id);
  if (ej === E.config.ejercicio && p.diasTrabajados != null) return p.diasTrabajados;
  const ing = empById(E, id)?.fechaIngreso ?? '';
  const ini = `${ej}-01-01`, fin = `${ej}-12-31`;
  if (!FECHA_RE.test(ing) || ing > fin) return 0;
  return habilesEntre(E, ing > ini ? ing : ini, fin);
}

export interface Legales { anios: number | null; legales: number; proporcional: boolean; trabajados: number; habiles: number }

/**
 * Días de ley. Si no trabajó la mitad de los hábiles del año (art. 151), corresponde 1 día cada
 * 20 trabajados (art. 153). Los hábiles se estiman con lunes a viernes menos feriados cargados;
 * el dato exacto se puede fijar en la ficha (`diasTrabajados`).
 */
export function legalesDe(E: EstadoVac, id: number, ej = E.config.ejercicio): Legales {
  return memo(E, `leg:${id}:${ej}`, () => {
    const anios = aniosAl(E, id, ej);
    if (anios === null) return { anios: null, legales: 0, proporcional: false, trabajados: 0, habiles: 0 };
    const habiles = habilesEntre(E, `${ej}-01-01`, `${ej}-12-31`);
    const trabajados = trabajadosEstimados(E, id, ej);
    const proporcional = trabajados < habiles / 2;
    const legales = proporcional ? Math.floor(trabajados / 20) : diasPorAntiguedad(empById(E, id)!.fechaIngreso, fechaCorte(E, id, ej));
    return { anios, legales, proporcional, trabajados, habiles };
  });
}

export interface DiasVac extends Legales {
  convenio: number;
  beneficio: number;
  arrastre: number;
  arrastrePedido: number;
  capArrastre: number;
  total: number;
  corte: string;
}

export function diasDe(E: EstadoVac, id: number): DiasVac {
  return memo(E, `dias:${id}`, () => {
    const p = perfilDe(E, id), L = legalesDe(E, id);
    const capArrastre = Math.floor(legalesDe(E, id, E.config.ejercicio - 1).legales / FRACCION_ARRASTRE);
    const arrastrePedido = p.arrastre.acuerdo ? p.arrastre.dias : 0;
    const arrastre = Math.min(arrastrePedido, capArrastre);
    return {
      ...L, convenio: p.extraConvenio, beneficio: p.extraBeneficio, arrastre, arrastrePedido, capArrastre,
      total: L.legales + p.extraConvenio + p.extraBeneficio + arrastre, corte: fechaCorte(E, id),
    };
  });
}

export const maxTramosDe = (E: EstadoVac, id: number) => Math.min(E.config.maxTramos, convenioDe(E, id).maxTramos);
export const avisoDe = (E: EstadoVac, id: number) => Math.max(E.config.avisoMinimoDias, convenioDe(E, id).avisoDias);

// ─── Solicitudes y tramos ───────────────────────────────────────────────────

export const solDe = (E: EstadoVac, id: number): Solicitud => E.solicitudes[id] ?? solVacia();
export const ocupa = (s: Solicitud | null | undefined) => !!s && (s.estado === 'enviada' || s.estado === 'aprobada');
export const noReprog = (s: Solicitud) => s.tramos.filter((t) => !t.reprog);

/** Pasó la fecha límite de carga y RRHH no la habilitó (una aprobada ya no la necesita). */
export function limiteVencido(E: EstadoVac, id: number): boolean {
  const s = solDe(E, id);
  return E.hoy > E.config.fechaLimiteCarga && !s.autorizaFueraTermino && s.estado !== 'aprobada';
}
const sumaDias = (ts: readonly { dias: number }[]) => ts.reduce((a, t) => a + t.dias, 0);
const diasInterrumpidos = (s: Solicitud) => s.interrupciones.reduce((a, x) => a + x.noGozados, 0);

export interface TramoEfectivo extends Tramo { colectivo?: boolean; nombre?: string }

export function cierresTemporada(E: EstadoVac): TramoEfectivo[] {
  return memo(E, 'cierres', () => E.config.cierres
    .filter((c) => solapan(c.desde, c.hasta, E.config.temporadaDesde, E.config.temporadaHasta))
    .map((c) => ({ desde: c.desde, hasta: c.hasta, dias: diffDias(c.desde, c.hasta) + 1, colectivo: true, nombre: c.nombre })));
}
export const diasCierres = (E: EstadoVac) => sumaDias(cierresTemporada(E));
export const tramosEfectivos = (E: EstadoVac, id: number): TramoEfectivo[] => [...solDe(E, id).tramos, ...cierresTemporada(E)];

/** Días ya asignados: tramos propios − días interrumpidos + cierres colectivos. */
export function usadosDe(E: EstadoVac, id: number, excluirDesde?: string): number {
  const s = solDe(E, id);
  return sumaDias(s.tramos.filter((t) => t.desde !== excluirDesde)) - diasInterrumpidos(s) + diasCierres(E);
}

/** Días interrumpidos que todavía no se reprogramaron (sin contar el tramo `excluirDesde`, el que se valida). */
export function pendienteReprog(E: EstadoVac, id: number, excluirDesde?: string): number {
  const s = solDe(E, id);
  return Math.max(0, diasInterrumpidos(s) - sumaDias(s.tramos.filter((t) => t.reprog && t.desde !== excluirDesde)));
}

function afueraEn(E: EstadoVac, id: number, desde: string, hasta: string, soloPersonales = false): boolean {
  const s = E.solicitudes[id];
  if (ocupa(s) && s.tramos.some((t) => solapan(t.desde, t.hasta, desde, hasta))) return true;
  return !soloPersonales && perfilDe(E, id).incluir && cierresTemporada(E).some((c) => solapan(c.desde, c.hasta, desde, hasta));
}

// ─── Áreas: cupo semanal y reglas de cobertura ──────────────────────────────

export function cupoSemana(E: EstadoVac, areaId: number | null, lunes: string): number | null {
  const a = areaId == null ? null : E.areas[areaId];
  if (!a) return null;
  return Object.prototype.hasOwnProperty.call(a.semanas, lunes) ? a.semanas[lunes] : a.cupo;
}

export function genteDeArea(E: EstadoVac, areaId: number): EmpleadoVac[] {
  return memo(E, `gente:${areaId}`, () => incluidos(E).filter((e) => e.areaId === areaId));
}

export function ocupacionSemana(E: EstadoVac, areaId: number, lunes: string, excluirId?: number): number {
  const fin = sumarDias(lunes, 6);
  return genteDeArea(E, areaId).filter((e) => e.id !== excluirId && afueraEn(E, e.id, lunes, fin, true)).length;
}

export function reglasDeArea(E: EstadoVac, areaId: number): ReglaCobertura[] {
  const a = E.areas[areaId];
  if (!a) return [];
  const auto: ReglaCobertura[] = a.jefeId && a.segundoId && a.jefeId !== a.segundoId
    ? [{ tipo: 'noJuntos', nombre: 'Jefe y segundo', ids: [a.jefeId, a.segundoId], auto: true }]
    : [];
  return [...auto, ...a.reglas];
}

function validarCobertura(E: EstadoVac, id: number, desde: string, hasta: string): Flag[] {
  const out: Flag[] = [];
  for (const areaId of Object.keys(E.areas).map(Number)) {
    for (const r of reglasDeArea(E, areaId)) {
      if (!r.ids.includes(id)) continue;
      const otros = r.ids.filter((o) => o !== id && empById(E, o) && perfilDe(E, o).incluir);
      if (r.tipo === 'noJuntos') {
        for (const o of otros) {
          if (!ocupa(E.solicitudes[o])) continue;
          for (const t of E.solicitudes[o].tramos) {
            if (solapan(t.desde, t.hasta, desde, hasta)) {
              out.push({
                tipo: 'error',
                msg: `Regla «${r.nombre}»: ${nombreDe(E, o)} ya sale del ${fmtD(t.desde)} al ${fmtD(t.hasta)} y no pueden coincidir.`,
                portal: 'Esas fechas se cruzan con las de otra persona de tu área que no puede faltar al mismo tiempo que vos.',
              });
            }
          }
        }
      } else {
        for (const w of semanasDeRango(desde, hasta)) {
          const fin = sumarDias(w, 6);
          const presentes = otros.filter((o) => !afueraEn(E, o, w, fin, true)).length;
          const minimo = r.min ?? 1;
          if (presentes < minimo) {
            out.push({
              tipo: 'error',
              msg: `Semana del ${fmtD(w)}: «${r.nombre}» quedaría con ${presentes} de ${minimo} personas mínimas.`,
              portal: `Semana del ${fmtD(w)}: tu área se quedaría sin la gente mínima que tiene que estar.`,
            });
          }
        }
      }
    }
  }
  return out;
}

/** Valida una regla nueva (la usa la API antes de guardarla). */
export function errorRegla(E: EstadoVac, r: { tipo: string; nombre: string; ids: number[]; min?: number }): string | null {
  if (r.tipo !== 'noJuntos' && r.tipo !== 'minimo') return 'Tipo de regla inválido.';
  if (!r.nombre.trim()) return 'Poné un nombre a la regla.';
  const ids = r.ids.filter((x) => empById(E, x));
  if (ids.length < 2) return 'Una regla necesita al menos 2 personas.';
  if (r.tipo === 'minimo' && (!Number.isInteger(r.min) || r.min! < 1 || r.min! >= ids.length)) {
    return 'El mínimo tiene que ser al menos 1 y menor que la cantidad de personas del grupo.';
  }
  return null;
}

// ─── Garantía de verano y orden de elección ─────────────────────────────────

export function veranoEstado(E: EstadoVac, id: number) {
  const n = Math.max(1, E.config.cicloVerano - 1), y = E.config.ejercicio, h = perfilDe(E, id).historial;
  const ultimos = Array.from({ length: n }, (_, i) => ({ anio: y - i - 1, dato: h[y - i - 1]?.verano ?? null }));
  return { ultimos, debe: ultimos.every((u) => u.dato === false), sinDatos: ultimos.some((u) => u.dato === null) };
}
export const debeVerano = (E: EstadoVac, id: number) => veranoEstado(E, id).debe;

/** Grupo en el que se compite por fechas: el área (el cupo es por área). */
export const grupoDe = (e: EmpleadoVac) => (e.areaId != null ? `a${e.areaId}` : `o${e.organigramaId ?? 0}:${e.area}`);

/**
 * Orden de elección dentro de un grupo. Siempre primero quien debe verano (art. 154) y las
 * preferencias de convenio (hijos en primaria, comercio); después el criterio elegido. En la
 * rotación, quien eligió último la temporada pasada va antes; sin historial, por antigüedad; el
 * sorteo con semilla desempata.
 */
export function ordenEleccion(E: EstadoVac, grupo: string): EmpleadoVac[] {
  return memo(E, `orden:${grupo}`, () => {
    const prev = String(E.config.ejercicio - 1), semilla = E.config.semillaSorteo;
    const clave = (e: EmpleadoVac): (number | string)[] => {
      const p = perfilDe(E, e.id), c = convenioDe(E, e.id), h = p.historial[prev];
      const k: (number | string)[] = [debeVerano(E, e.id) ? 0 : 1, c.hijosEscolares && p.hijosPrimaria ? 0 : 1];
      const ing = FECHA_RE.test(e.fechaIngreso) ? e.fechaIngreso : '9999-12-31', sorteo = hashStr(`${semilla}:${e.id}`);
      if (E.config.criterioOrden === 'rotacion') {
        const tiene = h?.pos != null;
        k.push(tiene ? 0 : 1, tiene ? -h!.pos! : 0, ing, sorteo);
      } else if (E.config.criterioOrden === 'antiguedad') k.push(ing, sorteo);
      else k.push(sorteo);
      return k;
    };
    const lista = incluidos(E).filter((e) => grupoDe(e) === grupo);
    const claves = new Map(lista.map((e) => [e.id, clave(e)] as const));
    return lista.sort((a, b) => {
      const ka = claves.get(a.id)!, kb = claves.get(b.id)!;
      for (let i = 0; i < ka.length; i++) { if (ka[i] < kb[i]) return -1; if (ka[i] > kb[i]) return 1; }
      return a.id - b.id;
    });
  });
}

function posicionDe(E: EstadoVac, id: number): number {
  const e = empById(E, id);
  if (!e) return 0;
  const l = ordenEleccion(E, grupoDe(e));
  const i = l.findIndex((x) => x.id === id);
  return i < 0 ? l.length : i;
}

export function aperturaDe(E: EstadoVac, id: number): string {
  const c = E.config;
  if (c.criterioOrden === 'llegada') return c.inicioProceso;
  return sumarDias(c.inicioProceso, Math.floor(posicionDe(E, id) / Math.max(1, c.personasPorTurno)) * Math.max(0, c.diasPorTurno));
}

export const turnoAbierto = (E: EstadoVac, id: number) => E.hoy >= aperturaDe(E, id);

// ─── Inicio (art. 151) ──────────────────────────────────────────────────────

/**
 * Empieza en lunes, o en el siguiente hábil si ese lunes es feriado. Con francos rotativos, el
 * día siguiente al descanso semanal, o el subsiguiente hábil si aquel es feriado.
 */
export function inicioValido(E: EstadoVac, id: number, desde: string): { ok: true } | { ok: false; msg: string } {
  const p = perfilDe(E, id);
  const esAncla = p.francoRotativo
    ? (d: string) => dow(sumarDias(d, -1)) === p.diaDescanso
    : (d: string) => dow(d) === 1;
  let ok = !esFeriado(E, desde) && (p.francoRotativo || esHabil(E, desde));
  if (ok) {
    ok = false;
    for (let d = desde, i = 0; i < 7; i++) {
      if (esAncla(d)) { ok = true; break; }
      d = sumarDias(d, -1);
      if (!esFeriado(E, d)) break;
    }
  }
  if (ok) return { ok: true };
  if (p.francoRotativo) {
    return { ok: false, msg: `Con francos rotativos, las vacaciones empiezan el día siguiente al descanso semanal (${DIAS_SEMANA[p.diaDescanso]}), o el hábil siguiente si ese día es feriado (art. 151 LCT).` };
  }
  if (dow(desde) === 1 && esFeriado(E, desde)) {
    return { ok: false, msg: 'Ese lunes es feriado: las vacaciones empiezan el primer día hábil siguiente (art. 151 LCT).' };
  }
  return { ok: false, msg: 'Las vacaciones empiezan un lunes, o el primer día hábil siguiente si ese lunes es feriado (art. 151 LCT).' };
}

/** Inicios válidos desde mañana hasta 120 días después de la temporada (alcanza para reprogramar). */
export function iniciosPosibles(E: EstadoVac, id: number): string[] {
  const out: string[] = [];
  const hasta = sumarDias(E.config.temporadaHasta, 120);
  for (let d = sumarDias(E.hoy, 1); d <= hasta; d = sumarDias(d, 1)) if (inicioValido(E, id, d).ok) out.push(d);
  return out;
}

/**
 * Día en que se vuelve a trabajar: el siguiente al último de vacaciones que no sea el descanso
 * semanal ni feriado. El sábado cuenta como laborable (mucha gente trabaja sábados alternos).
 */
export function vueltaDe(hasta: string, feriados: readonly string[], descanso = 0): string {
  let d = sumarDias(hasta, 1);
  while (dow(d) === descanso || feriados.includes(d)) d = sumarDias(d, 1);
  return d;
}

// ─── Validaciones ───────────────────────────────────────────────────────────

export interface OpcionesTramo { fueraAcuerdo?: boolean; reprog?: boolean }

/** Valida un tramo nuevo (o el tramo `ignorar` reemplazado por este). */
export function validarTramo(E: EstadoVac, id: number, desde: string, dias: number, ignorar?: string, opts: OpcionesTramo = {}): Flag[] {
  const out: Flag[] = [];
  const e = empById(E, id);
  if (!e) return [{ tipo: 'error', msg: 'La ficha no está activa en el organigrama.' }];
  if (!perfilDe(E, id).incluir) {
    return [{ tipo: 'error', msg: 'Esta persona no participa de la temporada (Personas › Participa).', portal: TEXTO_PORTAL.noParticipa }];
  }
  if (!desde || !FECHA_RE.test(desde)) return [{ tipo: 'error', msg: 'Falta la fecha de inicio.' }];
  if (!Number.isInteger(dias) || dias < 1) return [{ tipo: 'error', msg: 'La cantidad de días tiene que ser al menos 1.' }];
  if (dias > MAX_DIAS_TRAMO) return [{ tipo: 'error', msg: `Un tramo no puede superar los ${MAX_DIAS_TRAMO} días.` }];
  const d = diasDe(E, id);
  if (d.anios === null) {
    return [{ tipo: 'error', msg: 'Falta la fecha de ingreso: sin ella no se sabe cuántos días corresponden. Se carga en Nómina › Maestro.', portal: TEXTO_PORTAL.sinIngreso }];
  }
  const c = E.config, hasta = sumarDias(desde, dias - 1);

  // Art. 154: del 1/10 al 30/4; fuera de ese período, solo de mutuo acuerdo.
  if (desde < c.temporadaDesde || hasta > c.temporadaHasta) {
    if (!opts.fueraAcuerdo && !opts.reprog) out.push({ tipo: 'error', msg: 'El tramo cae fuera de la temporada: solo se admite de mutuo acuerdo (marcá la conformidad).' });
    else out.push({ tipo: 'warn', msg: 'Fuera de temporada por mutuo acuerdo (art. 154): queda registrado en la solicitud.' });
  }
  const iv = inicioValido(E, id, desde);
  if (!iv.ok) out.push({ tipo: 'error', msg: iv.msg });

  const sol = solDe(E, id);
  const otros = sol.tramos.filter((t) => t.desde !== ignorar);
  if (!opts.reprog) {
    const otrosNR = otros.filter((t) => !t.reprog);
    const mx = maxTramosDe(E, id);
    if (!c.fraccionar && otrosNR.length > 0) out.push({ tipo: 'error', msg: 'La política actual no permite fraccionar: las vacaciones se toman en un solo tramo.' });
    if (otrosNR.length + 1 > mx) out.push({ tipo: 'error', msg: `Tu convenio (${convenioDe(E, id).nombre}) admite como máximo ${mx} tramo(s).` });
    const fracc = otrosNR.length > 0 || dias < d.total - diasCierres(E);
    if (c.fraccionar && fracc && dias < c.tramoMinimo) out.push({ tipo: 'error', msg: `Cada tramo tiene que ser de al menos ${c.tramoMinimo} días corridos (art. 154).` });
  }
  if (otros.some((t) => solapan(t.desde, t.hasta, desde, hasta))) out.push({ tipo: 'error', msg: 'Se superpone con otro tramo tuyo.' });
  for (const x of cierresTemporada(E)) {
    if (solapan(x.desde, x.hasta, desde, hasta)) out.push({ tipo: 'error', msg: `Se superpone con el cierre colectivo «${x.nombre}» (${fmtD(x.desde)} al ${fmtD(x.hasta)}), que ya descuenta días.` });
  }
  const usados = usadosDe(E, id, ignorar);
  if (usados + dias > d.total) out.push({ tipo: 'error', msg: `Te pasás del total: ${usados + dias} días sobre ${d.total} disponibles.` });
  const porReprogramar = pendienteReprog(E, id, ignorar);
  if (opts.reprog && dias > porReprogramar) out.push({ tipo: 'error', msg: `Solo quedan ${porReprogramar} días por reprogramar.` });

  if (diffDias(E.hoy, desde) < avisoDe(E, id)) {
    out.push({ tipo: 'warn', msg: `Faltan menos de ${avisoDe(E, id)} días para el inicio: el aviso escrito legal no llega a tiempo, así que necesita la conformidad expresa de la persona.` });
  }
  if (e.areaId != null) {
    for (const w of semanasDeRango(desde, hasta)) {
      const cupo = cupoSemana(E, e.areaId, w);
      if (cupo == null) continue;
      const oc = ocupacionSemana(E, e.areaId, w, id);
      if (cupo <= 0) out.push({ tipo: 'error', msg: `Semana del ${fmtD(w)}: ${e.area} la tiene cerrada para vacaciones.` });
      else if (oc >= cupo) out.push({ tipo: 'error', msg: `Semana del ${fmtD(w)}: ${e.area} ya llegó a su cupo (${oc}/${cupo}).` });
    }
  }
  out.push(...validarCobertura(E, id, desde, hasta));
  return out;
}

export function validarSolicitud(E: EstadoVac, id: number): Flag[] {
  const out: Flag[] = [];
  const sol = solDe(E, id), d = diasDe(E, id), c = convenioDe(E, id), p = perfilDe(E, id), cfg = E.config;
  if (d.anios === null) out.push({ tipo: 'error', msg: 'Falta la fecha de ingreso (Nómina › Maestro).', portal: TEXTO_PORTAL.sinIngreso });
  if (!sol.tramos.length) out.push({ tipo: 'error', msg: 'Todavía no hay ningún tramo cargado.' });
  const usados = usadosDe(E, id);
  if (usados > d.total) out.push({ tipo: 'error', msg: `Hay ${usados} días cargados sobre ${d.total} disponibles.` });
  if (usados < d.total && sol.tramos.length) out.push({ tipo: 'warn', msg: `Quedan ${d.total - usados} días sin asignar. Se puede enviar igual y completarlos después.` });
  const nr = noReprog(sol);
  if (nr.length > maxTramosDe(E, id)) out.push({ tipo: 'error', msg: `Máximo ${maxTramosDe(E, id)} tramo(s) para ${c.nombre}.` });
  if (cfg.fraccionar && nr.length > 1) {
    if (cfg.tramoPrincipalPct > 0) {
      const minP = Math.ceil((d.total * cfg.tramoPrincipalPct) / 100);
      if (!nr.some((t) => t.dias >= minP)) {
        out.push({
          tipo: 'error',
          msg: `Al fraccionar, un tramo tiene que ser de al menos ${minP} días (${cfg.tramoPrincipalPct}% del total, política interna).`,
          portal: `Si las partís, una de las partes tiene que ser de al menos ${minP} días.`,
        });
      }
    }
    if (!sol.acuerdoFracc) out.push({ tipo: 'error', msg: 'Falta la conformidad del fraccionamiento: la ley lo permite solo por acuerdo de partes (art. 154).' });
  }
  if (debeVerano(E, id) && sol.tramos.length && !tramosEfectivos(E, id).some((t) => rangoTocaVerano(E.config, t.desde, t.hasta))) {
    out.push({ tipo: 'warn', msg: `Esta temporada te corresponde verano (art. 154: al menos una vez cada ${cfg.cicloVerano} años) y ningún tramo cae entre el ${fmtMmdd(cfg.veranoInicio)} y el ${fmtMmdd(cfg.veranoFin)}.` });
  }
  if (c.conyuges && p.conyugeId && empById(E, p.conyugeId)) {
    const sc = E.solicitudes[p.conyugeId];
    if (ocupa(sc) && sc.tramos.length && sol.tramos.length) {
      const coincide = sol.tramos.some((t) => sc.tramos.some((u) => u.desde === t.desde || u.hasta === t.hasta));
      if (!coincide) out.push({ tipo: 'warn', msg: `Tu convenio permite hacer coincidir el inicio o el fin con tu cónyuge (${nombreDe(E, p.conyugeId)}). Usá «Coincidir con mi cónyuge».` });
    }
  }
  if (d.arrastrePedido > d.capArrastre) out.push({ tipo: 'warn', msg: `El saldo arrastrado se limitó a ${d.capArrastre} días (1/${FRACCION_ARRASTRE} del período anterior, art. 164).` });
  if (limiteVencido(E, id)) {
    out.push({ tipo: 'error', msg: `Venció la fecha límite de carga (${fmtD(cfg.fechaLimiteCarga)}). RRHH tiene que autorizar la carga fuera de término.` });
  }
  for (const t of sol.tramos) {
    for (const v of validarTramo(E, id, t.desde, t.dias, t.desde, { fueraAcuerdo: !!t.fueraTemp, reprog: !!t.reprog })) {
      out.push({ tipo: v.tipo, msg: `Tramo ${fmtCorto(t.desde)}: ${v.msg}`, ...(v.portal && { portal: `Tramo ${fmtCorto(t.desde)}: ${v.portal}` }) });
    }
  }
  return out;
}

// ─── Aviso escrito (art. 154) ───────────────────────────────────────────────

export interface AvisoEstado {
  primero: string | null;
  limite: string | null;
  notificada: boolean;
  fecha: string | null;
  acuse: string | null;
  /** Se notificó (o todavía no) después del límite de aviso (`avisoDe`: 30 días o lo que pida el convenio). */
  tarde: boolean;
}

export function avisoEstado(E: EstadoVac, id: number): AvisoEstado | null {
  const sol = solDe(E, id);
  if (sol.estado !== 'aprobada') return null;
  const primero = sol.tramos.filter((t) => !t.reprog && t.hasta >= E.hoy).map((t) => t.desde).sort()[0] ?? null;
  const n = sol.notificacion, limite = primero ? sumarDias(primero, -avisoDe(E, id)) : null;
  return {
    primero, limite, notificada: !!n, fecha: n?.fecha ?? null, acuse: n?.acuse ?? null,
    tarde: !!(primero && limite && ((n && n.fecha > limite) || (!n && E.hoy > limite))),
  };
}

/** Notificada y dentro del plazo de aviso: las fechas solo cambian de mutuo acuerdo. */
export function ventanaBloqueada(E: EstadoVac, id: number): boolean {
  const sol = solDe(E, id);
  if (!sol.notificacion) return false;
  return sol.tramos.some((t) => !t.reprog && diffDias(E.hoy, t.desde) < avisoDe(E, id) && t.hasta >= E.hoy);
}

// ─── Acciones (puras: devuelven la solicitud nueva) ─────────────────────────

export type Resultado =
  | { ok: true; sol: Solicitud; accion: string; detalle: string }
  | { ok: false; error: string; errorPortal?: string };

const clonar = (s: Solicitud): Solicitud => structuredClone(s);
const falla = (error: string, errorPortal?: string): Resultado => ({ ok: false, error, errorPortal });
const rango = (t: { desde: string; hasta: string }) => `${fmtD(t.desde)} → ${fmtD(t.hasta)}`;
const editable = (s: Solicitud) => s.estado === 'borrador' || s.estado === 'rechazada';

export function agregarTramo(E: EstadoVac, id: number, desde: string, dias: number, opts: OpcionesTramo, por: string): Resultado {
  const s0 = solDe(E, id);
  if (opts.reprog && s0.estado !== 'aprobada') return falla('Solo se reprograman días de vacaciones aprobadas.');
  if (!opts.reprog && !editable(s0)) return falla(`La selección está ${s0.estado}: para cambiarla hay que reabrirla.`);
  const err = validarTramo(E, id, desde, dias, undefined, opts).find((f) => f.tipo === 'error');
  if (err) return falla(err.msg, err.portal);
  const s = clonar(s0);
  const t: Tramo = { desde, hasta: sumarDias(desde, dias - 1), dias };
  if (desde < E.config.temporadaDesde || t.hasta > E.config.temporadaHasta) t.fueraTemp = { fecha: E.hoy, por };
  if (opts.reprog) { t.reprog = true; t.estadoTramo = 'pendiente'; } else s.acuerdoFracc = null; // cambió el plan: nueva conformidad
  s.tramos = [...s.tramos, t].sort((a, b) => a.desde.localeCompare(b.desde));
  return {
    ok: true, sol: s, accion: opts.reprog ? 'Reprogramación solicitada' : 'Tramo agregado',
    detalle: `${rango(t)} (${dias} días)${t.fueraTemp ? ' · fuera de temporada por acuerdo' : ''}`,
  };
}

export function quitarTramo(E: EstadoVac, id: number, desde: string): Resultado {
  const s0 = solDe(E, id), t = s0.tramos.find((x) => x.desde === desde);
  if (!t) return falla('Ese tramo ya no existe.');
  if (!editable(s0) && !(t.reprog && t.estadoTramo === 'pendiente')) return falla(`La selección está ${s0.estado}: para cambiarla hay que reabrirla.`);
  // Sin el tramo, sus días no gozados quedarían descontando de la nada y se podrían volver a tomar.
  if (s0.interrupciones.some((i) => i.tramoDesde === desde)) return falla('Ese tramo tiene una interrupción registrada: no se puede quitar.');
  const s = clonar(s0);
  s.tramos = s.tramos.filter((x) => x.desde !== desde);
  if (!t.reprog) s.acuerdoFracc = null;
  return { ok: true, sol: s, accion: t.reprog ? 'Reprogramación retirada' : 'Tramo quitado', detalle: rango(t) };
}

export function conformidadFraccionamiento(E: EstadoVac, id: number, acepta: boolean, por: string, canal: 'portal' | 'papel'): Resultado {
  const s0 = solDe(E, id);
  if (!editable(s0)) return falla(`La selección está ${s0.estado}: la conformidad ya no se puede cambiar.`);
  if (acepta && noReprog(s0).length < 2) return falla('Con un solo tramo no hay fraccionamiento.');
  const s = clonar(s0);
  s.acuerdoFracc = acepta
    ? { fecha: E.hoy, tramos: noReprog(s0).map((t) => `${t.desde}/${t.dias}`).join(','), por, canal }
    : null;
  return {
    ok: true, sol: s, accion: acepta ? 'Conformidad de fraccionamiento firmada' : 'Conformidad de fraccionamiento retirada',
    detalle: `${noReprog(s0).length} tramos${acepta ? ` · ${canal === 'portal' ? 'en el portal' : 'en papel'}` : ''}`,
  };
}

export function enviar(E: EstadoVac, id: number): Resultado {
  const s0 = solDe(E, id);
  if (!editable(s0)) return falla(`La selección ya está ${s0.estado}.`);
  const err = validarSolicitud(E, id).find((f) => f.tipo === 'error');
  if (err) return falla(err.msg, err.portal);
  if (!turnoAbierto(E, id)) return falla(`El turno de elección abre el ${fmtD(aperturaDe(E, id))}.`);
  const s = clonar(s0);
  s.estado = 'enviada'; s.enviada = E.hoy; s.motivo = '';
  return { ok: true, sol: s, accion: 'Selección enviada', detalle: s.tramos.map(rango).join(', ') };
}

export function aprobar(E: EstadoVac, id: number): Resultado {
  const s0 = solDe(E, id);
  if (s0.estado !== 'enviada') return falla('Solo se aprueban selecciones enviadas.');
  const s = clonar(s0);
  s.estado = 'aprobada'; s.motivo = '';
  for (const t of s.tramos) if (t.reprog) t.estadoTramo = 'aprobado';
  return { ok: true, sol: s, accion: 'Selección aprobada', detalle: s.tramos.map(rango).join(', ') };
}

export function devolver(E: EstadoVac, id: number, motivo: string): Resultado {
  const s0 = solDe(E, id);
  if (s0.estado !== 'enviada') return falla('Solo se devuelven selecciones enviadas.');
  if (!motivo.trim()) return falla('Para devolver hay que indicar el motivo.');
  const s = clonar(s0);
  s.estado = 'rechazada'; s.motivo = motivo.trim();
  return { ok: true, sol: s, accion: 'Selección devuelta', detalle: s.motivo };
}

/** Vuelve a borrador (libera el cupo y anula la notificación). Notificada y en plazo: solo de mutuo acuerdo. */
export function reabrir(E: EstadoVac, id: number, motivo: string, mutuoAcuerdo: boolean): Resultado {
  const s0 = solDe(E, id);
  if (!ocupa(s0)) return falla('La selección no está enviada ni aprobada.');
  if (ventanaBloqueada(E, id) && !mutuoAcuerdo) {
    return falla('Las fechas ya fueron notificadas y el inicio está dentro del plazo de aviso: solo se cambian de mutuo acuerdo.');
  }
  const s = clonar(s0);
  const antes = s.estado;
  s.estado = 'borrador'; s.motivo = motivo.trim(); s.notificacion = null;
  return { ok: true, sol: s, accion: 'Selección reabierta', detalle: `${antes} → borrador${s.motivo ? ` · ${s.motivo}` : ''}${mutuoAcuerdo ? ' · de mutuo acuerdo' : ''}` };
}

export function notificar(E: EstadoVac, id: number, por: string): Resultado {
  const s0 = solDe(E, id);
  if (s0.estado !== 'aprobada') return falla('Solo se notifican selecciones aprobadas.');
  if (s0.notificacion) return falla(`Ya se notificó el ${fmtD(s0.notificacion.fecha)}.`);
  const s = clonar(s0);
  s.notificacion = { fecha: E.hoy, aviso: avisoDe(E, id), por, acuse: null, acusePor: null };
  const av = avisoEstado(E, id);
  return { ok: true, sol: s, accion: 'Notificación escrita emitida', detalle: `aviso de ${avisoDe(E, id)} días${av?.limite && E.hoy > av.limite ? ' · fuera de plazo' : ''}` };
}

export function acusarRecibo(E: EstadoVac, id: number, por: string): Resultado {
  const s0 = solDe(E, id);
  if (!s0.notificacion) return falla('No hay ninguna notificación para acusar.');
  if (s0.notificacion.acuse) return falla(`El recibo ya se acusó el ${fmtD(s0.notificacion.acuse)}.`);
  const s = clonar(s0);
  s.notificacion = { ...s0.notificacion, acuse: E.hoy, acusePor: por };
  return { ok: true, sol: s, accion: 'Acuse de recibo', detalle: `notificación del ${fmtD(s0.notificacion.fecha)}` };
}

/**
 * Interrupción (art. 154, Ley 27.802): por enfermedad informada en tiempo y con posibilidad de
 * control, o lo que prevea el convenio. El tramo no se acorta: la persona vuelve al final del
 * período previsto (o al alta, art. 208). Los días no gozados (`desde`–`hasta`) se reprograman.
 */
export function interrumpir(
  E: EstadoVac, id: number,
  x: { tramoDesde: string; desde: string; hasta: string; motivo: string; certificado: string; informada: boolean },
  por: string,
): Resultado {
  const s0 = solDe(E, id), t = s0.tramos.find((y) => y.desde === x.tramoDesde), c = convenioDe(E, id);
  if (s0.estado !== 'aprobada') return falla('Solo se interrumpen vacaciones aprobadas.');
  if (!t) return falla('Ese tramo no existe.');
  if (!Object.hasOwn(MOTIVOS_INTERRUPCION, x.motivo)) return falla('Motivo inválido.');
  const motivo = x.motivo as MotivoInterrupcion;
  if (motivo === 'fallecimiento' && !c.suspFallecimiento) return falla('El convenio de esta persona no prevé la suspensión por fallecimiento.');
  if (motivo === 'enfermedad' && (!x.informada || !x.certificado.trim())) {
    return falla('La enfermedad interrumpe solo si se informó en tiempo y permitió el control médico: confirmalo y cargá el certificado.');
  }
  if (!FECHA_RE.test(x.desde) || !FECHA_RE.test(x.hasta) || x.desde > x.hasta || x.desde < t.desde || x.hasta > t.hasta) {
    return falla(`Los días no gozados tienen que estar dentro del tramo (${fmtD(t.desde)} al ${fmtD(t.hasta)}).`);
  }
  if (s0.interrupciones.some((i) => solapan(i.desde, i.hasta, x.desde, x.hasta))) return falla('Esos días ya tienen una interrupción registrada.');
  const noGozados = diffDias(x.desde, x.hasta) + 1;
  const s = clonar(s0);
  s.interrupciones.push({ tramoDesde: t.desde, desde: x.desde, hasta: x.hasta, motivo, certificado: x.certificado.trim(), noGozados, registrada: E.hoy, por });
  return {
    ok: true, sol: s, accion: 'Vacaciones interrumpidas',
    detalle: `${MOTIVOS_INTERRUPCION[motivo]} · ${fmtD(x.desde)} al ${fmtD(x.hasta)} · ${noGozados} días a reprogramar${x.certificado.trim() ? ` · cert. ${x.certificado.trim()}` : ''}`,
  };
}

export function aprobarReprogramacion(E: EstadoVac, id: number, desde: string): Resultado {
  const s0 = solDe(E, id), t = s0.tramos.find((x) => x.desde === desde);
  if (!t?.reprog || t.estadoTramo !== 'pendiente') return falla('No hay una reprogramación pendiente con esa fecha.');
  const s = clonar(s0);
  s.tramos = s.tramos.map((x) => (x.desde === desde ? { ...x, estadoTramo: 'aprobado' as const } : x));
  return { ok: true, sol: s, accion: 'Reprogramación aprobada', detalle: rango(t) };
}

export function autorizarFueraTermino(E: EstadoVac, id: number): Resultado {
  const s0 = solDe(E, id);
  if (s0.autorizaFueraTermino) return falla('Ya estaba autorizada.');
  const s = clonar(s0);
  s.autorizaFueraTermino = true;
  return { ok: true, sol: s, accion: 'Carga fuera de término autorizada', detalle: `fecha límite ${fmtD(E.config.fechaLimiteCarga)}` };
}

// ─── Permutas (si el convenio las admite) ───────────────────────────────────

export function candidatosPermuta(E: EstadoVac, id: number): EmpleadoVac[] {
  const e = empById(E, id), sol = solDe(E, id);
  if (!e || !convenioDe(E, id).permutas || sol.estado !== 'aprobada') return [];
  const total = sumaDias(noReprog(sol));
  return incluidos(E).filter((o) => {
    if (o.id === e.id || o.rol !== e.rol || o.categoria !== e.categoria || !convenioDe(E, o.id).permutas) return false;
    const so = E.solicitudes[o.id];
    return so?.estado === 'aprobada' && sumaDias(noReprog(so)) === total;
  });
}

/** Intercambia los tramos aprobados de dos personas (misma función, categoría y días). */
export function permutar(E: EstadoVac, a: number, b: number): { ok: true; solA: Solicitud; solB: Solicitud } | { ok: false; error: string } {
  if (!candidatosPermuta(E, a).some((x) => x.id === b)) {
    return { ok: false, error: 'La permuta requiere idéntica función y categoría, convenio que la admita, ambas selecciones aprobadas y la misma cantidad de días.' };
  }
  const sa = clonar(solDe(E, a)), sb = clonar(solDe(E, b));
  // Las interrupciones y sus reprogramaciones son de la persona, no de las fechas: no se pueden intercambiar.
  if ([sa, sb].some((s) => s.interrupciones.length || s.tramos.some((t) => t.reprog))) {
    return { ok: false, error: 'No se pueden intercambiar fechas de vacaciones que tuvieron una interrupción.' };
  }
  [sa.tramos, sb.tramos] = [sb.tramos, sa.tramos];
  // El acuerdo de fraccionamiento acompaña a los tramos que acuerda.
  [sa.acuerdoFracc, sb.acuerdoFracc] = [sb.acuerdoFracc, sa.acuerdoFracc];
  sa.notificacion = null; sb.notificacion = null;
  const E2: EstadoVac = { ...E, solicitudes: { ...E.solicitudes, [a]: sa, [b]: sb } };
  for (const [p, s] of [[a, sa], [b, sb]] as const) {
    for (const t of s.tramos) {
      const err = validarCobertura(E2, p, t.desde, t.hasta)[0];
      if (err) return { ok: false, error: `${nombreDe(E, p)}: ${err.msg}` };
    }
  }
  return { ok: true, solA: sa, solB: sb };
}

// ─── Sugerencia de fechas ───────────────────────────────────────────────────

export function sugerirInicio(E: EstadoVac, id: number, dias: number): string | null {
  const c = E.config;
  for (let d = E.hoy > c.temporadaDesde ? E.hoy : c.temporadaDesde, g = 0; d <= c.temporadaHasta && g < 260; d = sumarDias(d, 1), g++) {
    if (inicioValido(E, id, d).ok && !validarTramo(E, id, d, dias).some((f) => f.tipo === 'error')) return d;
  }
  return null;
}

// ─── Pago (art. 155) y novedades para Nómina ────────────────────────────────

function remuneracionDe(E: EstadoVac, id: number): { valor: number; fuente: string } {
  const p = perfilDe(E, id), e = empById(E, id);
  if (p.remuneracionRef && p.remuneracionRef > 0) return { valor: p.remuneracionRef, fuente: 'ficha de vacaciones' };
  if (e && e.basico > 0) return { valor: e.basico, fuente: 'Nómina (básico)' };
  return { valor: 0, fuente: 'sin dato' };
}

export interface Anticipo {
  empId: number; nombre: string; area: string; tipo: string; desde: string; hasta: string; dias: number;
  pago: string; base: number; fuente: string; criterio: string; valorDia: number; importe: number;
}

/**
 * Art. 155: la retribución de las vacaciones se paga al inicio (acá, el hábil anterior). Mensual:
 * sueldo ÷ 25 por día. Los cierres colectivos le corresponden a todos los que participan.
 */
export function anticipos(E: EstadoVac): Anticipo[] {
  const out: Anticipo[] = [];
  for (const e of incluidos(E)) {
    const sol = E.solicitudes[e.id], aprobada = sol?.estado === 'aprobada';
    const r = remuneracionDe(E, e.id), c = convenioDe(E, e.id), vd = r.valor / DIVISOR_VALOR_DIA;
    for (const t of aprobada ? tramosEfectivos(E, e.id) : cierresTemporada(E)) {
      if (t.reprog && t.estadoTramo !== 'aprobado') continue;
      out.push({
        empId: e.id, nombre: e.nombre, area: e.area, desde: t.desde, hasta: t.hasta, dias: t.dias, pago: habilAnterior(E, t.desde),
        base: r.valor, fuente: r.fuente, valorDia: Math.round(vd * 100) / 100, importe: Math.round(vd * t.dias * 100) / 100,
        criterio: c.remuneracion === 'mayor12' ? 'Mayor remuneración de los últimos 12 meses (convenio)' : 'Remuneración vigente',
        tipo: t.colectivo ? 'Cierre colectivo' : t.reprog ? 'Reprogramación' : 'Vacaciones',
      });
    }
  }
  return out.sort((a, b) => a.pago.localeCompare(b.pago) || a.nombre.localeCompare(b.nombre));
}

/** Días de vacaciones gozados por persona y mes (sin los interrumpidos), para Nómina › Novedades. */
export function diasPorMes(E: EstadoVac): { empId: number; nombre: string; area: string; mes: string; dias: number }[] {
  const acc = new Map<string, { empId: number; nombre: string; area: string; mes: string; dias: number }>();
  for (const e of incluidos(E)) {
    const sol = E.solicitudes[e.id], aprobada = sol?.estado === 'aprobada';
    const interr = aprobada ? sol.interrupciones : [];
    for (const t of aprobada ? tramosEfectivos(E, e.id) : cierresTemporada(E)) {
      if (t.reprog && t.estadoTramo !== 'aprobado') continue;
      for (let f = t.desde; f <= t.hasta; f = sumarDias(f, 1)) {
        if (interr.some((i) => f >= i.desde && f <= i.hasta)) continue;
        const k = `${e.id}|${f.slice(0, 7)}`;
        const x = acc.get(k) ?? { empId: e.id, nombre: e.nombre, area: e.area, mes: f.slice(0, 7), dias: 0 };
        x.dias++;
        acc.set(k, x);
      }
    }
  }
  return [...acc.values()].sort((a, b) => a.mes.localeCompare(b.mes) || a.nombre.localeCompare(b.nombre));
}

// ─── Problemas a revisar ────────────────────────────────────────────────────

/** Personas a las que el turno para elegir les abre después de la fecha límite de carga. */
export function conTurnoTarde(E: EstadoVac): number {
  if (E.config.criterioOrden === 'llegada') return 0;
  return incluidos(E).filter((e) => aperturaDe(E, e.id) > E.config.fechaLimiteCarga).length;
}

export interface Problema { empId: number; msg: string }

/** Problemas legales de cada persona que RR.HH. tiene que resolver (Solicitudes los lista). */
export function problemasDePersonas(E: EstadoVac): Problema[] {
  return memo(E, 'problemas', () => {
    const out: Problema[] = [], fin = E.config.temporadaHasta;
    for (const e of incluidos(E)) {
      const sol = E.solicitudes[e.id], d = diasDe(E, e.id), n = e.nombre;
      const agregar = (msg: string) => out.push({ empId: e.id, msg: `${n}: ${msg}` });
      if (d.anios === null) agregar('falta la fecha de ingreso (Nómina › Maestro).');
      if (sol?.estado === 'enviada' && noReprog(sol).length > 1 && !sol.acuerdoFracc) agregar('fraccionó sin conformidad.');
      const av = avisoEstado(E, e.id);
      if (av?.primero && !av.notificada && av.tarde) agregar(`aprobada sin notificación escrita. Límite para notificar: ${fmtD(av.limite)}.`);
      const restan = d.total - (ocupa(sol) ? usadosDe(E, e.id) : diasCierres(E));
      if (restan > 0 && diffDias(E.hoy, fin) <= 60 && diffDias(E.hoy, fin) >= -31) {
        agregar(`${restan} días sin asignar y la temporada cierra el ${fmtD(fin)}. Si no se le otorgan, puede tomarlas por sí con aviso fehaciente, para terminarlas antes del 31/5 (art. 157).`);
      }
      if (ocupa(sol) && usadosDe(E, e.id) > d.total) {
        agregar(`tiene ${usadosDe(E, e.id)} días asignados sobre ${d.total}${cierresTemporada(E).length ? ' (el cierre colectivo se suma a sus tramos)' : ''}. Hay que acortar un tramo.`);
      }
    }
    return out;
  });
}

// ─── Cierre de temporada ────────────────────────────────────────────────────

export interface CierreTemporada {
  perfiles: Record<number, { historial: Record<string, HistorialTemporada>; arrastre: PerfilVac['arrastre'] }>;
  config: ConfigVacaciones;
  resumen: { personas: number; conVerano: number; arrastres: number };
}

/**
 * Guarda en cada ficha si tuvo verano y en qué turno eligió (para la rotación y la garantía),
 * propone el arrastre de lo no gozado (hasta 1/3 de lo legal, sin acuerdo: art. 164 exige que las
 * partes lo convengan) y pasa las fechas al ejercicio siguiente.
 */
export function cerrarTemporada(E: EstadoVac): CierreTemporada {
  const ej = E.config.ejercicio, perfiles: CierreTemporada['perfiles'] = {}, resumen = { personas: 0, conVerano: 0, arrastres: 0 };
  for (const e of incluidos(E)) {
    const sol = E.solicitudes[e.id], aprobada = sol?.estado === 'aprobada';
    const efect = aprobada ? tramosEfectivos(E, e.id).filter((t) => !t.reprog || t.estadoTramo === 'aprobado') : cierresTemporada(E);
    const verano = efect.some((t) => rangoTocaVerano(E.config, t.desde, t.hasta));
    const d = diasDe(E, e.id), gozados = sumaDias(efect) - (aprobada ? diasInterrumpidos(sol) : 0);
    const p = perfilDe(E, e.id);
    perfiles[e.id] = {
      historial: { ...p.historial, [ej]: { verano, pos: posicionDe(E, e.id) } },
      arrastre: { dias: Math.min(Math.max(0, d.total - gozados), Math.floor(d.legales / FRACCION_ARRASTRE)), acuerdo: false, origen: ej },
    };
    resumen.personas++;
    if (verano) resumen.conVerano++;
    if (perfiles[e.id].arrastre.dias) resumen.arrastres++;
  }
  const c = E.config;
  const config: ConfigVacaciones = {
    ...c, ejercicio: ej + 1, cierres: [], semillaSorteo: String(ej + 1),
    temporadaDesde: addYears(c.temporadaDesde, 1), temporadaHasta: addYears(c.temporadaHasta, 1),
    inicioProceso: addYears(c.inicioProceso, 1), fechaLimiteCarga: addYears(c.fechaLimiteCarga, 1),
  };
  return { perfiles, config, resumen };
}

// ─── Vista de una selección (Mis vacaciones y la carga de RRHH) ─────────────

export interface VistaSeleccion {
  empleado: { id: number; nombre: string; rol: string; area: string; organigrama: string; fotoArchivo: string | null };
  hoy: string;
  ejercicio: number;
  temporada: { desde: string; hasta: string };
  dias: DiasVac;
  convenio: { codigo: string; nombre: string };
  tramoMinimo: number;
  fraccionar: boolean;
  avisoDias: number;
  usados: number;
  turno: { apertura: string; abierto: boolean };
  verano: { debe: boolean; desde: string; hasta: string };
  sol: Solicitud;
  aviso: AvisoEstado | null;
  fechaLimite: string;
  limiteVencido: boolean;
  pendienteReprog: number;
  cierres: TramoEfectivo[];
  validacion: Flag[];
  /** Días (desde mañana) en que puede empezar un tramo según el art. 151; el calendario solo deja tocar estos. */
  inicios: string[];
  /** Participa de la temporada (Personas › Participa). */
  participa: boolean;
  /** Para `vueltaDe` en el cliente: feriados cargados y día de descanso semanal (0 = domingo). */
  feriados: string[];
  descanso: number;
  conyuge: { nombre: string; desde: string; dias: number } | null;
}

export function vistaSeleccion(E: EstadoVac, id: number): VistaSeleccion | null {
  const e = empById(E, id);
  if (!e) return null;
  const sol = solDe(E, id), c = convenioDe(E, id), p = perfilDe(E, id), cfg = E.config;
  const sc = p.conyugeId != null && c.conyuges ? E.solicitudes[p.conyugeId] : undefined;
  const t0 = ocupa(sc) ? sc!.tramos[0] : undefined;
  return {
    empleado: { id, nombre: e.nombre, rol: e.rol, area: e.area, organigrama: e.organigrama, fotoArchivo: e.fotoArchivo },
    hoy: E.hoy,
    ejercicio: cfg.ejercicio,
    temporada: { desde: cfg.temporadaDesde, hasta: cfg.temporadaHasta },
    dias: diasDe(E, id),
    convenio: { codigo: c.codigo, nombre: c.nombre },
    tramoMinimo: cfg.tramoMinimo,
    fraccionar: cfg.fraccionar,
    avisoDias: avisoDe(E, id),
    usados: usadosDe(E, id),
    turno: { apertura: aperturaDe(E, id), abierto: turnoAbierto(E, id) },
    verano: { debe: debeVerano(E, id), desde: cfg.veranoInicio, hasta: cfg.veranoFin },
    sol,
    aviso: avisoEstado(E, id),
    fechaLimite: cfg.fechaLimiteCarga,
    limiteVencido: limiteVencido(E, id),
    pendienteReprog: pendienteReprog(E, id),
    cierres: cierresTemporada(E),
    validacion: validarSolicitud(E, id),
    inicios: iniciosPosibles(E, id),
    participa: p.incluir,
    feriados: cfg.feriados,
    descanso: p.francoRotativo ? p.diaDescanso : 0,
    conyuge: t0 && p.conyugeId != null ? { nombre: nombreDe(E, p.conyugeId), desde: t0.desde, dias: t0.dias } : null,
  };
}
