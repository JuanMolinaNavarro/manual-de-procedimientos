/**
 * Servidor del calendario de asistencia: versiones de horario por empleado,
 * parámetros generales, armado del calendario del mes y migración de los
 * horarios viejos de la ficha. La lógica pura vive en `asistencia-calendario.ts`.
 */

import { Prisma, type AsistenciaHorario as HorarioRow } from '@prisma/client';
import { prisma } from './prisma';
import { AsistenciaError } from './asistencia';
import { ESTADO_EMPLEADO_ACTIVO, hoyLocal, personaActiva, sumarDias } from './asistencia-datos';
import {
  armarCalendario,
  detectarFeriados,
  diasDelRango,
  rangoMes,
  resumenLiquidacion,
  ultimaVersion,
  type ConfigAsistencia,
  type ResumenLiquidacion,
  type DiasHorario,
  type FichadaDia,
  type HorarioInput,
  type HorarioVersion,
} from './asistencia-calendario';

function aVersion(r: HorarioRow): HorarioVersion {
  return {
    id: r.id,
    empleadoId: r.empleado_id,
    vigenteDesde: r.vigente_desde,
    vigenteHasta: r.vigente_hasta,
    incluir: r.incluir,
    cicloSemanas: r.ciclo_semanas,
    cicloAncla: r.ciclo_ancla,
    toleranciaMin: r.tolerancia_min,
    dias: (r.dias ?? {}) as DiasHorario,
  };
}

// ─── Config (singleton id = 1) ───────────────────────────────────────────────

export async function getConfigAsistencia(): Promise<ConfigAsistencia> {
  const row = await prisma.asistenciaConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  return { toleranciaMin: row.tolerancia_min, tardeGraveMin: row.tarde_grave_min };
}

export async function setConfigAsistencia(cfg: ConfigAsistencia, username: string | null): Promise<ConfigAsistencia> {
  await getConfigAsistencia(); // garantiza que la fila exista
  const row = await prisma.asistenciaConfig.update({
    where: { id: 1 },
    data: { tolerancia_min: cfg.toleranciaMin, tarde_grave_min: cfg.tardeGraveMin, updated_by: username },
  });
  return { toleranciaMin: row.tolerancia_min, tardeGraveMin: row.tarde_grave_min };
}

// ─── Versiones ───────────────────────────────────────────────────────────────

/** Todas las versiones (de un empleado o de todos), la más reciente primero. */
export async function listarHorarios(empleadoId?: number): Promise<HorarioVersion[]> {
  const rows = await prisma.asistenciaHorario.findMany({
    where: empleadoId != null ? { empleado_id: empleadoId } : undefined,
    orderBy: [{ empleado_id: 'asc' }, { vigente_desde: 'desc' }],
  });
  return rows.map(aVersion);
}

export interface ResultadoGuardar {
  horario: HorarioVersion;
  /** Versión anterior que se cerró el día previo a `aplicarDesde`, si hubo. */
  cerrada: HorarioVersion | null;
  /** Se corrigió la última versión en el lugar (misma fecha de inicio). */
  corregida: boolean;
}

/**
 * Guarda un horario "aplicando desde" una fecha. Nunca reescribe el pasado:
 * - Si `aplicarDesde` es posterior al inicio de la última versión, la cierra
 *   el día anterior y crea una nueva (abierta).
 * - Si coincide con el inicio de la última versión, la corrige en el lugar.
 * - Si es anterior, se rechaza: primero hay que deshacer la posterior.
 * Con `versionEsperadaId` definido, exige que la última versión sea esa (409 si
 * otro admin guardó en el medio). El unique (empleado, vigente_desde) atrapa el
 * doble submit.
 */
export async function guardarVersionHorario(input: HorarioInput, username: string | null): Promise<ResultadoGuardar> {
  const emp = await prisma.orgEmpleado.findUnique({ where: { id: input.empleadoId }, select: { id: true } });
  if (!emp) throw new AsistenciaError('Empleado no encontrado', 404);

  const data = {
    incluir: input.incluir,
    ciclo_semanas: input.cicloSemanas,
    ciclo_ancla: input.cicloAncla,
    tolerancia_min: input.toleranciaMin,
    dias: input.dias as Prisma.InputJsonValue,
    updated_by: username,
  };

  try {
    return await prisma.$transaction(async (tx) => {
      const rows = await tx.asistenciaHorario.findMany({ where: { empleado_id: input.empleadoId }, orderBy: { vigente_desde: 'desc' } });
      const ult = rows[0] ?? null;
      if (input.versionEsperadaId !== undefined && (ult?.id ?? null) !== input.versionEsperadaId) {
        throw new AsistenciaError('Otro usuario modificó este horario. Cerrá y volvé a abrir el editor.', 409);
      }

      if (!ult || input.aplicarDesde > ult.vigente_desde) {
        let cerrada: HorarioVersion | null = null;
        if (ult && (ult.vigente_hasta == null || ult.vigente_hasta >= input.aplicarDesde)) {
          const c = await tx.asistenciaHorario.update({
            where: { id: ult.id },
            data: { vigente_hasta: sumarDias(input.aplicarDesde, -1), updated_by: username },
          });
          cerrada = aVersion(c);
        }
        const nueva = await tx.asistenciaHorario.create({
          data: { ...data, empleado_id: input.empleadoId, vigente_desde: input.aplicarDesde, vigente_hasta: null, created_by: username },
        });
        return { horario: aVersion(nueva), cerrada, corregida: false };
      }

      if (input.aplicarDesde === ult.vigente_desde) {
        const corr = await tx.asistenciaHorario.update({ where: { id: ult.id }, data });
        return { horario: aVersion(corr), cerrada: null, corregida: true };
      }

      throw new AsistenciaError(
        `Ya hay una versión que empieza el ${ult.vigente_desde}. Para aplicar desde una fecha anterior, primero deshacé esa versión.`,
      );
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new AsistenciaError('Ya existe una versión con esa fecha de inicio (¿doble clic en Guardar?)', 409);
    }
    throw e;
  }
}

/**
 * Deshace la última versión de un empleado. Si la anterior se había cerrado
 * justo el día antes (es decir, la cerró esta versión), se reabre.
 */
export async function borrarUltimaVersion(id: number, username: string | null): Promise<{ borrada: HorarioVersion; reabierta: HorarioVersion | null }> {
  return prisma.$transaction(async (tx) => {
    const v = await tx.asistenciaHorario.findUnique({ where: { id } });
    if (!v) throw new AsistenciaError('Versión no encontrada', 404);
    const rows = await tx.asistenciaHorario.findMany({ where: { empleado_id: v.empleado_id }, orderBy: { vigente_desde: 'desc' } });
    if (rows[0]?.id !== v.id) throw new AsistenciaError('Solo se puede deshacer la última versión del horario');
    await tx.asistenciaHorario.delete({ where: { id } });
    const anterior = rows[1];
    let reabierta: HorarioVersion | null = null;
    if (anterior && anterior.vigente_hasta === sumarDias(v.vigente_desde, -1)) {
      const r = await tx.asistenciaHorario.update({ where: { id: anterior.id }, data: { vigente_hasta: null, updated_by: username } });
      reabierta = aVersion(r);
    }
    return { borrada: aVersion(v), reabierta };
  });
}

// ─── Calendario del mes ──────────────────────────────────────────────────────

/**
 * Tope de fichadas que se agrupan para el calendario (un mes × toda la
 * nómina). Con 150 personas y 4 marcas por día son ~13.000; el tope deja
 * margen y evita traer la tabla entera si alguien pasa un mes disparatado.
 */
const MAX_FILAS_CALENDARIO = 50_000;

export interface FilaCalendarioMes {
  clave: string; // 'e:<empleadoId>' | 'u:<userId>'
  empleadoId: number | null;
  userIds: string[];
  nombre: string;
  area: string | null;
  rol: string | null;
  fotoArchivo: string | null;
  tieneHorario: boolean;
  celdas: ReturnType<typeof armarCalendario>['filas'][number]['celdas'];
  totales: ReturnType<typeof armarCalendario>['filas'][number]['totales'];
}

export interface CalendarioMes {
  mes: string;
  desde: string;
  hasta: string;
  hoy: string;
  config: ConfigAsistencia;
  dias: ReturnType<typeof armarCalendario>['dias'];
  filas: FilaCalendarioMes[];
  /** Personas activas sin horario vigente (se listan solo con `incluirSinHorario`). */
  sinHorario: number;
  /** Feriados detectados por baja asistencia (`detectarFeriados`), yyyy-mm-dd. */
  feriados: string[];
  truncado: boolean;
}

/**
 * Filas del calendario: empleados del organigrama con alguna versión `incluir`
 * que toque el mes (aunque no tengan legajo en el reloj: quedan en ausente y
 * eso es información), más, a pedido, las personas activas sin horario
 * (vinculadas o no) con sus marcas en gris. Las fichadas de un empleado son
 * la unión de las de todos sus `user_id` del reloj.
 */
export async function calendarioMes(mes: string, incluirSinHorario: boolean, soloClave?: string): Promise<CalendarioMes> {
  const { desde, hasta } = rangoMes(mes);
  const hoy = hoyLocal();
  const [cfg, versionesRows, personas] = await Promise.all([
    getConfigAsistencia(),
    prisma.asistenciaHorario.findMany({
      where: { vigente_desde: { lte: hasta }, OR: [{ vigente_hasta: null }, { vigente_hasta: { gte: desde } }] },
      orderBy: { vigente_desde: 'desc' },
    }),
    prisma.asistenciaPersona.findMany({
      include: { empleado: { select: { id: true, nombre: true, rol: true, area: true, foto_archivo: true, estado: true, nomina: { select: { fecha_ingreso: true } } } } },
      orderBy: { user_id: 'asc' },
    }),
  ]);

  const versionesPor = new Map<number, HorarioVersion[]>();
  for (const r of versionesRows) {
    const v = aVersion(r);
    if (!versionesPor.has(v.empleadoId)) versionesPor.set(v.empleadoId, []);
    versionesPor.get(v.empleadoId)!.push(v);
  }
  const conHorario = new Set([...versionesPor.entries()].filter(([, vs]) => vs.some((v) => v.incluir)).map(([id]) => id));

  // Empleados con horario que no tienen persona del reloj: igual son fila.
  const personasPorEmpleado = new Map<number, typeof personas>();
  for (const p of personas) {
    if (p.empleado_id == null) continue;
    if (!personasPorEmpleado.has(p.empleado_id)) personasPorEmpleado.set(p.empleado_id, []);
    personasPorEmpleado.get(p.empleado_id)!.push(p);
  }
  const sinPersona = [...conHorario].filter((id) => !personasPorEmpleado.has(id));
  const empleadosSueltos = sinPersona.length
    ? await prisma.orgEmpleado.findMany({
        where: { id: { in: sinPersona } },
        select: { id: true, nombre: true, rol: true, area: true, foto_archivo: true, estado: true, nomina: { select: { fecha_ingreso: true } } },
      })
    : [];

  type Emp = NonNullable<(typeof personas)[number]['empleado']>;
  type FilaBase = { clave: string; empleadoId: number | null; userIds: string[]; nombre: string; area: string | null; rol: string | null; fotoArchivo: string | null; versiones: HorarioVersion[]; fechaIngreso: string | null; activa: boolean };
  const filas: FilaBase[] = [];
  const filaEmpleado = (e: Emp, userIds: string[]): FilaBase => ({
    clave: `e:${e.id}`,
    empleadoId: e.id,
    userIds,
    nombre: e.nombre,
    area: e.area,
    rol: e.rol,
    fotoArchivo: e.foto_archivo,
    versiones: versionesPor.get(e.id) ?? [],
    fechaIngreso: e.nomina?.fecha_ingreso || null,
    activa: e.estado === ESTADO_EMPLEADO_ACTIVO,
  });
  for (const ps of personasPorEmpleado.values()) filas.push(filaEmpleado(ps[0].empleado!, ps.map((p) => p.user_id)));
  for (const e of empleadosSueltos) filas.push(filaEmpleado(e, []));
  for (const p of personas) {
    if (p.empleado_id != null) continue;
    filas.push({
      clave: `u:${p.user_id}`,
      empleadoId: null,
      userIds: [p.user_id],
      nombre: p.nombre_reloj || p.user_id,
      area: null,
      rol: null,
      fotoArchivo: null,
      versiones: [],
      fechaIngreso: null,
      activa: personaActiva({ empleadoId: null, activo: p.activo, empleadoEstado: null }),
    });
  }

  const tieneHorario = (f: FilaBase) => f.empleadoId != null && conHorario.has(f.empleadoId);
  const sinHorario = filas.filter((f) => f.activa && !tieneHorario(f)).length;
  // Con horario: activos siempre (un inactivo con versión abierta no figura como
  // ausente). Sin horario: solo a pedido y solo activos.
  // `soloClave` (perfil de una persona) trae esa fila aunque esté inactiva.
  const visibles = filas.filter((f) => (soloClave ? f.clave === soloClave : f.activa && (tieneHorario(f) || incluirSinHorario)));
  // Feriados: sobre el pool de TODAS las personas activas del reloj (todos los
  // relojes, con o sin horario), no sobre lo que se muestra. Una consulta
  // agregada (persona × día) alcanza: solo hace falta cuántas ficharon cada día.
  const activosUserIds = personas
    .filter((p) => personaActiva({ empleadoId: p.empleado_id, activo: p.activo, empleadoEstado: p.empleado?.estado ?? null }))
    .map((p) => p.user_id);
  const presentesPorFecha = new Map<string, number>();
  if (activosUserIds.length) {
    const grupos = await prisma.asistenciaFichada.groupBy({
      by: ['user_id', 'fecha'],
      where: { user_id: { in: activosUserIds }, fecha: { gte: desde, lte: hasta } },
    });
    for (const g of grupos) presentesPorFecha.set(g.fecha, (presentesPorFecha.get(g.fecha) ?? 0) + 1);
  }
  const feriados = detectarFeriados(diasDelRango(desde, hasta), activosUserIds.length, presentesPorFecha, hoy);

  const userIds = [...new Set(visibles.flatMap((f) => f.userIds))];
  const fichadas = userIds.length
    ? await prisma.asistenciaFichada.findMany({
        where: { user_id: { in: userIds }, fecha: { gte: desde, lte: hasta } },
        select: { user_id: true, fecha: true, fecha_hora: true, tipo: true },
        orderBy: { fecha_hora: 'asc' },
        take: MAX_FILAS_CALENDARIO,
      })
    : [];
  const porUser = new Map<string, Record<string, FichadaDia[]>>();
  for (const f of fichadas) {
    let porFecha = porUser.get(f.user_id);
    if (!porFecha) porUser.set(f.user_id, (porFecha = {}));
    (porFecha[f.fecha] ??= []).push({ fechaHora: f.fecha_hora.toISOString(), tipo: f.tipo });
  }

  const conFichadas = (f: FilaBase) => {
    const fichadasPorFecha: Record<string, FichadaDia[]> = {};
    for (const u of f.userIds) {
      for (const [fecha, marcas] of Object.entries(porUser.get(u) ?? {})) (fichadasPorFecha[fecha] ??= []).push(...marcas);
    }
    const { activa: _a, ...resto } = f;
    void _a;
    return { ...resto, fichadasPorFecha };
  };
  const cal = armarCalendario({ desde, hasta, hoy, cfg, filas: visibles.map(conFichadas), feriados });
  const filasOrdenadas = [...cal.filas].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  return { mes, desde, hasta, hoy, config: cfg, dias: cal.dias, filas: filasOrdenadas, sinHorario, feriados: [...feriados].sort(), truncado: fichadas.length === MAX_FILAS_CALENDARIO };
}

// ─── Perfil de una persona ───────────────────────────────────────────────────

export interface PerfilPersona extends Omit<CalendarioMes, 'filas' | 'sinHorario' | 'truncado'> {
  feriados: string[];
  persona: { id: number; userId: string; nombreReloj: string; empleadoId: number | null; nombre: string; activa: boolean };
  /** null si la persona no aparece en el calendario del mes (no debería pasar con `soloClave`). */
  fila: FilaCalendarioMes | null;
  resumen: ResumenLiquidacion | null;
  /** Versiones de horario de la ficha vinculada (vacío si no está vinculada). */
  versiones: HorarioVersion[];
}

/** Mes de una persona con el resumen para liquidar (ausencias, tardanzas, horas). */
export async function perfilPersona(personaId: number, mes: string): Promise<PerfilPersona> {
  const p = await prisma.asistenciaPersona.findUnique({
    where: { id: personaId },
    include: { empleado: { select: { id: true, nombre: true, estado: true } } },
  });
  if (!p) throw new AsistenciaError('Persona no encontrada', 404);
  const clave = p.empleado_id != null ? `e:${p.empleado_id}` : `u:${p.user_id}`;
  const [cal, versiones] = await Promise.all([calendarioMes(mes, true, clave), p.empleado_id != null ? listarHorarios(p.empleado_id) : Promise.resolve([])]);
  const fila = cal.filas[0] ?? null;
  return {
    mes: cal.mes,
    desde: cal.desde,
    hasta: cal.hasta,
    hoy: cal.hoy,
    config: cal.config,
    dias: cal.dias,
    feriados: cal.feriados,
    persona: {
      id: p.id,
      userId: p.user_id,
      nombreReloj: p.nombre_reloj,
      empleadoId: p.empleado_id,
      nombre: p.empleado?.nombre || p.nombre_reloj || p.user_id,
      activa: personaActiva({ empleadoId: p.empleado_id, activo: p.activo, empleadoEstado: p.empleado?.estado ?? null }),
    },
    fila,
    resumen: fila ? resumenLiquidacion(fila.celdas) : null,
    versiones,
  };
}


export { ultimaVersion };
