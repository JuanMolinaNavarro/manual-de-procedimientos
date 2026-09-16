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
  /** Solo fichadas con fecha imposible. Ignora el rango: por definición cae afuera. */
  soloSospechosas?: boolean;
  /** Solo días sin marca de salida. Aplica únicamente a la vista por día. */
  soloIncompletos?: boolean;
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

// ─── Rangos de fecha ────────────────────────────────────────────────────────
// Todo se calcula sobre yyyy-mm-dd en UTC. Las fechas del módulo son días
// locales ya resueltos (`hoyLocal`), así que acá no hay que volver a corregir
// el huso: hacerlo dos veces es justo lo que corría las fichadas un día.

const DIA_MS = 86_400_000;

function aMs(yyyymmdd: string): number {
  const [a, m, d] = yyyymmdd.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
}

function aIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Suma (o resta) días a un yyyy-mm-dd. */
export function sumarDias(yyyymmdd: string, dias: number): string {
  return aIso(aMs(yyyymmdd) + dias * DIA_MS);
}

/** Cantidad de días del rango, inclusive en ambos extremos. */
export function diasEntre(desde: string, hasta: string): number {
  return Math.floor((aMs(hasta) - aMs(desde)) / DIA_MS) + 1;
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

// ─── Resumen del período ────────────────────────────────────────────────────

/** Una fila del groupBy (user_id, fecha, tipo) con su conteo. */
export interface GrupoFichadas {
  userId: string;
  fecha: string;
  tipo: number;
  marcas: number;
}

export interface PersonaResumen {
  userId: string;
  nombre: string;
  empleadoId: number | null;
}

export interface ResumenAsistencia {
  rango: { desde: string; hasta: string; dias: number };
  totales: {
    fichadas: number;
    personasConMarcas: number;
    personasTotales: number;
    personasSinVincular: number;
    /** Pares (persona, día) con al menos una marca, sin contar el día de hoy. */
    diasPersona: number;
    /** De esos, los que no tienen ninguna marca de salida. */
    diasIncompletos: number;
  };
  hoy: { fecha: string; enRango: boolean; presentes: number };
  porDia: { fecha: string; marcas: number; personas: number }[];
  incompletos: { userId: string; nombre: string; empleadoId: number | null; dias: number }[];
  incompletosTotal: number;
  relojes: { total: number; activos: number; conError: number; ultimoSync: string | null };
  ultimaFichada: string | null;
}

/** Lo que se calcula solo con los grupos; el resto lo agrega el servidor. */
export type ResumenBase = Omit<ResumenAsistencia, 'relojes' | 'ultimaFichada'>;

const TOP_INCOMPLETOS = 10;
/** Tope de barras del gráfico por día, para no mandar un JSON absurdo. */
const MAX_DIAS_SERIE = 366;

/**
 * Agrega los grupos (persona, día, tipo) en los números del Resumen.
 *
 * Deliberadamente **no** calcula horas trabajadas ni tardanzas: acá no entra la
 * jornada esperada, y `salida − entrada` es falso apenas alguien ficha un
 * descanso o se olvida de marcar la salida — que es justo el caso que el módulo
 * tiene que detectar. Las tardanzas y ausencias viven en el Calendario
 * (`asistencia-calendario.ts`), que las deriva solo para quien tiene una versión
 * de horario vigente. Un número inventado en la pantalla que se usa para
 * liquidar es peor que ningún número.
 */
export function armarResumen(
  grupos: GrupoFichadas[],
  personas: PersonaResumen[],
  rango: { desde: string; hasta: string },
  hoy = hoyLocal(),
): ResumenBase {
  // (persona, día) → marcas y si hubo alguna salida.
  const dias = new Map<string, { userId: string; fecha: string; marcas: number; tieneSalida: boolean }>();
  let fichadas = 0;

  for (const g of grupos) {
    if (g.fecha < rango.desde || g.fecha > rango.hasta) continue;
    fichadas += g.marcas;
    const key = `${g.userId}|${g.fecha}`;
    let d = dias.get(key);
    if (!d) {
      d = { userId: g.userId, fecha: g.fecha, marcas: 0, tieneSalida: false };
      dias.set(key, d);
    }
    d.marcas += g.marcas;
    if (g.tipo === 1) d.tieneSalida = true;
  }

  const porFecha = new Map<string, { marcas: number; personas: Set<string> }>();
  const incompletosPorUsuario = new Map<string, number>();
  const conMarcas = new Set<string>();
  let diasCerrados = 0;
  let diasIncompletos = 0;

  for (const d of dias.values()) {
    conMarcas.add(d.userId);
    let acc = porFecha.get(d.fecha);
    if (!acc) {
      acc = { marcas: 0, personas: new Set() };
      porFecha.set(d.fecha, acc);
    }
    acc.marcas += d.marcas;
    acc.personas.add(d.userId);
    // El día de hoy no se juzga: la jornada está en curso y quien todavía no se
    // fue no tiene una salida faltante sino pendiente. Contarla llenaría el KPI
    // de falsos positivos cada mañana. Queda fuera del numerador y también del
    // denominador (`diasPersona`), para que el ratio compare días cerrados.
    if (d.fecha === hoy) continue;
    diasCerrados++;
    if (!d.tieneSalida) {
      diasIncompletos++;
      incompletosPorUsuario.set(d.userId, (incompletosPorUsuario.get(d.userId) ?? 0) + 1);
    }
  }

  // La serie cubre el rango completo: un día hábil en cero es justamente lo que
  // hay que ver (el reloj se cayó), y si solo mandáramos los días con datos
  // desaparecería del gráfico.
  const totalDias = diasEntre(rango.desde, rango.hasta);
  const porDia: ResumenBase['porDia'] = [];
  if (totalDias > 0 && totalDias <= MAX_DIAS_SERIE) {
    for (let i = 0; i < totalDias; i++) {
      const fecha = sumarDias(rango.desde, i);
      const acc = porFecha.get(fecha);
      porDia.push({ fecha, marcas: acc?.marcas ?? 0, personas: acc?.personas.size ?? 0 });
    }
  } else {
    for (const [fecha, acc] of [...porFecha.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      porDia.push({ fecha, marcas: acc.marcas, personas: acc.personas.size });
    }
  }

  const nombrePorUser = new Map(personas.map((p) => [p.userId, p]));
  const incompletos = [...incompletosPorUsuario.entries()]
    .map(([userId, cant]) => ({
      userId,
      nombre: nombrePorUser.get(userId)?.nombre ?? userId,
      empleadoId: nombrePorUser.get(userId)?.empleadoId ?? null,
      dias: cant,
    }))
    .sort((a, b) => b.dias - a.dias || a.nombre.localeCompare(b.nombre));

  const hoyEnRango = hoy >= rango.desde && hoy <= rango.hasta;
  const presentes = porFecha.get(hoy)?.personas.size ?? 0;

  return {
    rango: { desde: rango.desde, hasta: rango.hasta, dias: totalDias },
    totales: {
      fichadas,
      personasConMarcas: conMarcas.size,
      personasTotales: personas.length,
      personasSinVincular: personas.filter((p) => p.empleadoId == null).length,
      diasPersona: diasCerrados,
      diasIncompletos,
    },
    hoy: { fecha: hoy, enRango: hoyEnRango, presentes },
    porDia,
    incompletos: incompletos.slice(0, TOP_INCOMPLETOS),
    incompletosTotal: incompletos.length,
  };
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

/** 05/09 08:32 — para las tarjetas de relojes, donde el año sobra. */
export function fmtFechaCorta(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ_RELOJ });
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
