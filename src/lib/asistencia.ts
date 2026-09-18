/**
 * Módulo Asistencia: operaciones de servidor sobre las fichadas de los relojes
 * Anviz. Sincroniza por TCP (protocolo TC-B, `anviz-tcb.ts`), importa la base de
 * CrossChex (.mdb) como respaldo/histórico y ofrece las consultas para la UI.
 */

import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { ClienteAnviz, conReloj, type RegistroReloj } from './anviz-tcb';
import { updateEmpleado } from './organigrama';
import {
  ORIGEN_CROSSCHEX,
  ORIGEN_RELOJ,
  OFFSET_RELOJ_MIN,
  ESTADO_EMPLEADO_ACTIVO,
  ESTADO_EMPLEADO_INACTIVO,
  esFechaImposible,
  FILAS_POR_PAGINA,
  hoyLocal,
  sumarDias,
  armarResumen,
  personaActiva,
  type FiltrosFichadas,
  type ModoDescarga,
  type ResumenAsistencia,
} from './asistencia-datos';
import { resumirFichadas, type FichadaDia } from './asistencia-calendario';

/** Error con status HTTP para el wrapper de la API. */
export class AsistenciaError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = 'AsistenciaError';
  }
}

// ─── Relojes ─────────────────────────────────────────────────────────────────

export async function listarRelojes() {
  return prisma.asistenciaReloj.findMany({ orderBy: { device_id: 'asc' } });
}

export async function getReloj(id: number) {
  const reloj = await prisma.asistenciaReloj.findUnique({ where: { id } });
  if (!reloj) throw new AsistenciaError('Reloj no encontrado', 404);
  return reloj;
}

export interface DatosReloj {
  nombre: string;
  ip: string;
  puerto?: number;
  device_id: number;
  activo?: boolean;
  limpiar_nuevos?: boolean;
}

export async function crearReloj(d: DatosReloj) {
  validarReloj(d);
  try {
    return await prisma.asistenciaReloj.create({
      data: {
        nombre: d.nombre.trim(),
        ip: d.ip.trim(),
        puerto: d.puerto ?? 5010,
        device_id: d.device_id,
        activo: d.activo ?? true,
        limpiar_nuevos: d.limpiar_nuevos ?? false,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new AsistenciaError(`Ya existe un reloj con device_id ${d.device_id}`, 409);
    }
    throw e;
  }
}

export async function actualizarReloj(id: number, patch: Partial<DatosReloj>) {
  await getReloj(id);
  const data: Prisma.AsistenciaRelojUpdateInput = {};
  if (patch.nombre !== undefined) data.nombre = patch.nombre.trim();
  if (patch.ip !== undefined) data.ip = patch.ip.trim();
  if (patch.puerto !== undefined) data.puerto = patch.puerto;
  if (patch.activo !== undefined) data.activo = patch.activo;
  if (patch.limpiar_nuevos !== undefined) data.limpiar_nuevos = patch.limpiar_nuevos;
  if (patch.device_id !== undefined) data.device_id = patch.device_id;
  return prisma.asistenciaReloj.update({ where: { id }, data });
}

export async function borrarReloj(id: number) {
  await getReloj(id);
  await prisma.asistenciaReloj.delete({ where: { id } });
}

function validarReloj(d: DatosReloj) {
  if (!d.nombre?.trim()) throw new AsistenciaError('Falta el nombre del reloj');
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test((d.ip ?? '').trim())) throw new AsistenciaError('IP inválida');
  if (!Number.isInteger(d.device_id) || d.device_id <= 0) throw new AsistenciaError('device_id inválido');
}

/** Prueba la conexión: info + contadores, sin guardar nada. */
export async function probarReloj(id: number) {
  const reloj = await getReloj(id);
  return conReloj({ ip: reloj.ip, puerto: reloj.puerto, deviceId: reloj.device_id }, async (c) => {
    const info = await c.obtenerInfo().catch(() => null);
    const contadores = await c.obtenerContadores();
    return { firmware: info?.firmware ?? null, contadores };
  });
}

// ─── Sincronización directa por TCP ──────────────────────────────────────────

let sincronizando = false;
export const isSyncAsistenciaRunning = () => sincronizando;

export interface ResultadoSync {
  relojId: number;
  nombre: string;
  bajados: number;
  guardados: number;
  contadores?: { registrosTotales: number; registrosNuevos: number; usuarios: number };
  error?: string;
}

/**
 * Sincroniza un reloj: contadores → descarga (nuevos o todos) → guarda con
 * deduplicación → actualiza estado. Si el reloj tiene `limpiar_nuevos`, borra la
 * marca al final (solo cuando CrossChex ya no lo use).
 */
export async function sincronizarReloj(id: number, modo: ModoDescarga = 'nuevos'): Promise<ResultadoSync> {
  const reloj = await getReloj(id);
  const base: ResultadoSync = { relojId: reloj.id, nombre: reloj.nombre, bajados: 0, guardados: 0 };
  try {
    const res = await conReloj(
      { ip: reloj.ip, puerto: reloj.puerto, deviceId: reloj.device_id, timeoutMs: 8000 },
      async (c) => {
        const contadores = await c.obtenerContadores();
        let bajados = 0;
        let guardados = 0;
        await c.descargarRegistros(modo, async (lote) => {
          bajados += lote.length;
          guardados += await guardarRegistros(reloj.id, lote);
        });
        return { contadores, bajados, guardados };
      },
    );
    await prisma.asistenciaReloj.update({
      where: { id: reloj.id },
      data: {
        ultimo_sync: new Date(),
        ultimo_error: null,
        reg_total: res.contadores.registrosTotales,
        reg_nuevos: res.contadores.registrosNuevos,
        usuarios: res.contadores.usuarios,
      },
    });
    if (reloj.limpiar_nuevos && res.contadores.registrosNuevos > 0) {
      await conReloj({ ip: reloj.ip, puerto: reloj.puerto, deviceId: reloj.device_id }, (c) =>
        c.limpiarNuevos(res.contadores.registrosNuevos),
      );
    }
    return {
      ...base,
      bajados: res.bajados,
      guardados: res.guardados,
      contadores: {
        registrosTotales: res.contadores.registrosTotales,
        registrosNuevos: res.contadores.registrosNuevos,
        usuarios: res.contadores.usuarios,
      },
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Error desconocido';
    await prisma.asistenciaReloj.update({ where: { id: reloj.id }, data: { ultimo_error: error, ultimo_sync: new Date() } }).catch(() => {});
    return { ...base, error };
  }
}

/** Sincroniza todos los relojes activos en serie. Un error no frena a los demás. */
export async function sincronizarTodos(modo: ModoDescarga = 'nuevos'): Promise<ResultadoSync[]> {
  if (sincronizando) throw new AsistenciaError('Ya hay una sincronización en curso', 409);
  sincronizando = true;
  try {
    const relojes = await prisma.asistenciaReloj.findMany({ where: { activo: true }, orderBy: { device_id: 'asc' } });
    const out: ResultadoSync[] = [];
    for (const r of relojes) out.push(await sincronizarReloj(r.id, modo));
    return out;
  } finally {
    sincronizando = false;
  }
}

/** Inserta un lote de registros del reloj deduplicando; devuelve cuántos entraron nuevos. */
async function guardarRegistros(relojId: number, lote: RegistroReloj[]): Promise<number> {
  if (lote.length === 0) return 0;
  await asegurarPersonas(lote.map((r) => r.userId));
  const res = await prisma.asistenciaFichada.createMany({
    data: lote.map((r) => ({
      reloj_id: relojId,
      user_id: r.userId,
      fecha_hora: r.fechaHora,
      fecha: r.fecha,
      tipo: r.tipo,
      modo: r.modo,
      work_type: r.workType,
      origen: ORIGEN_RELOJ,
    })),
    skipDuplicates: true,
  });
  // Una fichada NO cambia `activo`: la baja/alta de una persona es siempre manual.
  return res.count;
}

/** Crea las personas del reloj que aún no existan (nombre se completa al importar el .mdb o a mano). */
async function asegurarPersonas(userIds: string[]) {
  const unicos = [...new Set(userIds)];
  const existentes = new Set(
    (await prisma.asistenciaPersona.findMany({ where: { user_id: { in: unicos } }, select: { user_id: true } })).map((p) => p.user_id),
  );
  const faltantes = unicos.filter((u) => !existentes.has(u));
  if (faltantes.length) {
    await prisma.asistenciaPersona.createMany({ data: faltantes.map((user_id) => ({ user_id })), skipDuplicates: true });
  }
}

// ─── Importación de la base de CrossChex (.mdb) ──────────────────────────────

export interface ResultadoImport {
  relojes: number;
  personas: number;
  fichadas: number;
  fichadasNuevas: number;
}

/**
 * Importa `FingerClient` (relojes), `Userinfo` (personas) y `Checkinout`
 * (fichadas, origen 'crosschex') de un .mdb de CrossChex. Usa `mdb-reader`
 * (JavaScript puro), así que corre igual en Linux.
 */
export async function importarMdb(buffer: Buffer): Promise<ResultadoImport> {
  if (buffer.length < 16 || buffer.toString('latin1', 4, 19) !== 'Standard Jet DB') {
    // Access 2007+ (.accdb) usa "Standard ACE DB"; ambos los abre mdb-reader.
    if (buffer.toString('latin1', 4, 19) !== 'Standard ACE DB') {
      throw new AsistenciaError('El archivo no es una base de Access válida (.mdb/.accdb)');
    }
  }
  const { default: MDBReader } = await import('mdb-reader');
  let reader: InstanceType<typeof MDBReader>;
  try {
    reader = new MDBReader(buffer);
  } catch {
    throw new AsistenciaError('No se pudo abrir la base de Access (¿protegida con contraseña?)');
  }
  const tablas = new Set(reader.getTableNames());

  // Relojes (FingerClient): device_id = ClientNumber.
  let relojesTocados = 0;
  const relojPorSensor = new Map<number, number>(); // ClientNumber → AsistenciaReloj.id
  if (tablas.has('FingerClient')) {
    for (const raw of reader.getTable('FingerClient').getData() as Record<string, unknown>[]) {
      const row = ci(raw);
      const deviceId = num(pick(row, 'clientnumber'));
      if (deviceId == null) continue;
      const nombre = String(pick(row, 'clientname') ?? `Reloj ${deviceId}`).trim() || `Reloj ${deviceId}`;
      const ip = String(pick(row, 'ipaddress') ?? '').trim();
      const reloj = await prisma.asistenciaReloj.upsert({
        where: { device_id: deviceId },
        update: { nombre, ...(ip ? { ip } : {}) },
        create: { device_id: deviceId, nombre, ip: ip || '0.0.0.0', puerto: num(pick(row, 'commport')) ?? 5010, activo: false },
      });
      relojPorSensor.set(deviceId, reloj.id);
      relojesTocados++;
    }
  }
  // Un reloj "sin sensor" para fichadas cuyo Sensorid no esté en FingerClient.
  const relojHuerfano = async () => {
    const existente = await prisma.asistenciaReloj.findUnique({ where: { device_id: 0 } });
    if (existente) return existente.id;
    const r = await prisma.asistenciaReloj.create({ data: { device_id: 0, nombre: 'Sin reloj (importado)', ip: '0.0.0.0', activo: false } });
    return r.id;
  };

  // Personas (Userinfo): Userid = ID en el reloj, Name viene truncado.
  let personas = 0;
  if (tablas.has('Userinfo')) {
    const rows = reader.getTable('Userinfo').getData() as Record<string, unknown>[];
    for (const grupo of chunk(rows, 500)) {
      await Promise.all(
        grupo.map((raw) => {
          const row = ci(raw);
          const userId = String(pick(row, 'userid') ?? '').trim();
          if (!userId) return Promise.resolve();
          const nombre = String(pick(row, 'name') ?? '').trim();
          return prisma.asistenciaPersona.upsert({
            where: { user_id: userId },
            update: nombre ? { nombre_reloj: nombre } : {},
            create: { user_id: userId, nombre_reloj: nombre },
          });
        }),
      );
      personas += grupo.length;
    }
  }

  // Fichadas (Checkinout).
  let fichadas = 0;
  let fichadasNuevas = 0;
  if (tablas.has('Checkinout')) {
    const rows = (reader.getTable('Checkinout').getData() as Record<string, unknown>[]).map(ci);
    const userIds = new Set<string>();
    for (const r of rows) { const u = String(pick(r, 'userid') ?? '').trim(); if (u) userIds.add(u); }
    await asegurarPersonas([...userIds]);
    let huerfano: number | null = null;
    for (const grupo of chunk(rows, 5000)) {
      const data: Prisma.AsistenciaFichadaCreateManyInput[] = [];
      for (const row of grupo) {
        const userId = String(pick(row, 'userid') ?? '').trim();
        const wall = fechaDeMdb(pick(row, 'checktime'));
        if (!userId || !wall) continue;
        const sensor = num(pick(row, 'sensorid'));
        let relojId = sensor != null ? relojPorSensor.get(sensor) : undefined;
        if (relojId == null) { huerfano ??= await relojHuerfano(); relojId = huerfano; }
        data.push({
          reloj_id: relojId,
          user_id: userId,
          fecha_hora: instanteReal(wall),
          fecha: wall.toISOString().slice(0, 10),
          tipo: num(pick(row, 'checktype')) ?? 0,
          work_type: num(pick(row, 'worktype')) ?? null,
          origen: ORIGEN_CROSSCHEX,
        });
      }
      if (data.length) {
        const res = await prisma.asistenciaFichada.createMany({ data, skipDuplicates: true });
        fichadasNuevas += res.count;
        fichadas += data.length;
      }
    }
  }

  return { relojes: relojesTocados, personas, fichadas, fichadasNuevas };
}

// ─── Personas ────────────────────────────────────────────────────────────────

export async function listarPersonas() {
  const hoy = hoyLocal();
  const [personas, empleados, ultimas] = await Promise.all([
    prisma.asistenciaPersona.findMany({ orderBy: { user_id: 'asc' } }),
    prisma.orgEmpleado.findMany({ select: { id: true, nombre: true, rol: true, area: true, estado: true } }),
    // Última marca real por persona; las fechas imposibles no cuentan.
    prisma.asistenciaFichada.groupBy({
      by: ['user_id'],
      where: { fecha: { gte: LIMITE_PASADO, lte: sumarDias(hoy, 1) } },
      _max: { fecha_hora: true },
    }),
  ]);
  const porId = new Map(empleados.map((e) => [e.id, e]));
  const ultimaPor = new Map(ultimas.map((u) => [u.user_id, u._max.fecha_hora]));
  return personas.map((p) => {
    const emp = p.empleado_id != null ? porId.get(p.empleado_id) : undefined;
    const empleadoEstado = emp?.estado ?? null;
    return {
      id: p.id,
      userId: p.user_id,
      nombreReloj: p.nombre_reloj,
      empleadoId: p.empleado_id,
      empleado: emp ? { id: emp.id, nombre: emp.nombre, rol: emp.rol, area: emp.area } : null,
      nombre: emp?.nombre || p.nombre_reloj || p.user_id,
      activoPropio: p.activo,
      empleadoEstado,
      activa: personaActiva({ empleadoId: p.empleado_id, activo: p.activo, empleadoEstado }),
      ultimaFichada: ultimaPor.get(p.user_id)?.toISOString() ?? null,
    };
  });
}

/**
 * Prende o apaga a una persona. Si está vinculada, la fuente de verdad es el
 * organigrama y el cambio va ahí (`estado`); si no, a su propio `activo`. En
 * los dos casos `activo` queda alineado, para que no asome un valor viejo si
 * más adelante se la desvincula.
 */
export async function setPersonaActiva(id: number, activa: boolean) {
  const persona = await prisma.asistenciaPersona.findUnique({ where: { id } });
  if (!persona) throw new AsistenciaError('Persona no encontrada', 404);
  if (persona.empleado_id != null) {
    const emp = await updateEmpleado(persona.empleado_id, {
      estado: activa ? ESTADO_EMPLEADO_ACTIVO : ESTADO_EMPLEADO_INACTIVO,
    });
    if (!emp) throw new AsistenciaError('Empleado no encontrado', 404);
  }
  return prisma.asistenciaPersona.update({ where: { id }, data: { activo: activa } });
}


export async function vincularPersona(id: number, empleadoId: number | null) {
  const persona = await prisma.asistenciaPersona.findUnique({ where: { id } });
  if (!persona) throw new AsistenciaError('Persona no encontrada', 404);
  if (empleadoId != null) {
    const emp = await prisma.orgEmpleado.findUnique({ where: { id: empleadoId }, select: { id: true, nombre: true } });
    if (!emp) throw new AsistenciaError('Empleado no encontrado', 404);
    // Una ficha del organigrama tiene un solo legajo del reloj: si ya está
    // vinculada a otra persona, primero hay que desvincular esa.
    const otra = await prisma.asistenciaPersona.findFirst({ where: { empleado_id: empleadoId, id: { not: id } }, select: { user_id: true } });
    if (otra) throw new AsistenciaError(`${emp.nombre} ya está vinculado al legajo ${otra.user_id}. Desvinculalo primero.`, 409);
  }
  return prisma.asistenciaPersona.update({ where: { id }, data: { empleado_id: empleadoId } });
}

/**
 * Vincula automáticamente por CUIL: el DNI (dígitos 3-10 del CUIL cargado en el
 * maestro de nómina) contra el `user_id` del reloj. Solo vincula las personas
 * que todavía no tengan empleado y donde el match sea único.
 */
export async function vincularPorCuil(): Promise<{ vinculadas: number }> {
  const [personas, maestros, yaVinculados] = await Promise.all([
    prisma.asistenciaPersona.findMany({ where: { empleado_id: null } }),
    prisma.nominaEmpleado.findMany({ where: { cuil: { not: '' } }, select: { empleado_id: true, cuil: true } }),
    prisma.asistenciaPersona.findMany({ where: { empleado_id: { not: null } }, select: { empleado_id: true } }),
  ]);
  // Una ficha ya vinculada a un legajo no se vuelve a ofrecer.
  const ocupados = new Set(yaVinculados.map((p) => p.empleado_id));
  const dniAEmpleado = new Map<string, number[]>();
  for (const m of maestros) {
    if (ocupados.has(m.empleado_id)) continue;
    const dni = m.cuil.replace(/\D/g, '').slice(2, 10);
    if (dni.length === 8) (dniAEmpleado.get(dni) ?? dniAEmpleado.set(dni, []).get(dni)!).push(m.empleado_id);
  }
  let vinculadas = 0;
  for (const p of personas) {
    const dni = p.user_id.replace(/\D/g, '');
    const cands = dniAEmpleado.get(dni);
    if (cands && cands.length === 1 && !ocupados.has(cands[0])) {
      await prisma.asistenciaPersona.update({ where: { id: p.id }, data: { empleado_id: cands[0] } });
      ocupados.add(cands[0]);
      vinculadas++;
    }
  }
  return { vinculadas };
}

// ─── Consultas de fichadas ───────────────────────────────────────────────────

/** Fecha más vieja que consideramos real; antes de eso, el reloj estaba mal puesto. */
const LIMITE_PASADO = '2010-01-01';

/**
 * `user_id`s cuyo nombre a mostrar (organigrama → nombre del reloj → id) matchea
 * `q`. La búsqueda por nombre tiene que resolverse a ids **antes** del where: el
 * nombre vive en otra tabla, y filtrarlo después de paginar hacía que `total` y
 * la cantidad de páginas no tuvieran nada que ver con lo que se veía.
 */
async function userIdsQueMatchean(q: string): Promise<string[]> {
  const needle = q.trim();
  const personas = await prisma.asistenciaPersona.findMany({
    where: {
      OR: [
        { user_id: { contains: needle, mode: 'insensitive' } },
        { nombre_reloj: { contains: needle, mode: 'insensitive' } },
        { empleado: { is: { nombre: { contains: needle, mode: 'insensitive' } } } },
      ],
    },
    select: { user_id: true },
  });
  return personas.map((p) => p.user_id);
}

async function whereFichadas(f: FiltrosFichadas): Promise<Prisma.AsistenciaFichadaWhereInput> {
  const w: Prisma.AsistenciaFichadaWhereInput = {};

  if (f.soloSospechosas) {
    // Una fichada con fecha imposible cae, por definición, fuera de cualquier
    // rango razonable: acotar por `desde`/`hasta` acá daría siempre vacío.
    w.OR = [{ fecha: { gt: sumarDias(hoyLocal(), 1) } }, { fecha: { lt: LIMITE_PASADO } }];
  } else {
    w.fecha = { gte: f.desde, lte: f.hasta };
  }

  if (f.relojId) w.reloj_id = f.relojId;
  if (f.userId) w.user_id = f.userId;

  if (f.q?.trim()) {
    const ids = await userIdsQueMatchean(f.q);
    // El `contains` es por si hay fichadas de un user_id sin fila en
    // AsistenciaPersona (hoy `asegurarPersonas` lo evita, pero no dependemos).
    w.AND = [{ OR: [{ user_id: { in: ids } }, { user_id: { contains: f.q.trim(), mode: 'insensitive' } }] }];
  }

  return w;
}

/** Fichadas detalladas paginadas, con nombre resuelto por persona/organigrama. */
export async function listarFichadas(f: FiltrosFichadas, page = 1) {
  const where = await whereFichadas(f);
  const [total, rows, relojes] = await Promise.all([
    prisma.asistenciaFichada.count({ where }),
    prisma.asistenciaFichada.findMany({
      where,
      orderBy: [{ fecha_hora: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * FILAS_POR_PAGINA,
      take: FILAS_POR_PAGINA,
    }),
    prisma.asistenciaReloj.findMany({ select: { id: true, nombre: true } }),
  ]);
  const nombreReloj = new Map(relojes.map((r) => [r.id, r.nombre]));
  const nombres = await nombresPorUserId(rows.map((r) => r.user_id));
  const items = rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    nombre: nombres.get(r.user_id) ?? r.user_id,
    reloj: nombreReloj.get(r.reloj_id) ?? `#${r.reloj_id}`,
    fechaHora: r.fecha_hora.toISOString(),
    tipo: r.tipo,
    modo: r.modo,
    origen: r.origen,
    sospechosa: esFechaImposible(r.fecha_hora.toISOString()),
  }));
  return { total, page, pageSize: FILAS_POR_PAGINA, items };
}

/**
 * Tope de fichadas que se agrupan en la vista "por día". Sin esto, un rango
 * largo traía la tabla entera a memoria y la mandaba completa al navegador.
 */
const MAX_FILAS_DIA = 20_000;

/** Resumen por persona y día: entrada, salida (por tipo de marca) y cantidad de marcas. */
export async function resumenPorDia(f: FiltrosFichadas, page = 1) {
  const hoy = hoyLocal();
  const rows = await prisma.asistenciaFichada.findMany({
    where: await whereFichadas(f),
    orderBy: [{ fecha: 'desc' }, { fecha_hora: 'asc' }],
    select: { user_id: true, fecha: true, fecha_hora: true, tipo: true },
    take: MAX_FILAS_DIA,
  });
  const truncado = rows.length === MAX_FILAS_DIA;
  const nombres = await nombresPorUserId(rows.map((r) => r.user_id));
  type Dia = { userId: string; nombre: string; fecha: string; marcas: FichadaDia[] };
  const mapa = new Map<string, Dia>();
  for (const r of rows) {
    const key = `${r.user_id}|${r.fecha}`;
    let acc = mapa.get(key);
    if (!acc) {
      acc = { userId: r.user_id, nombre: nombres.get(r.user_id) ?? r.user_id, fecha: r.fecha, marcas: [] };
      mapa.set(key, acc);
    }
    acc.marcas.push({ fechaHora: r.fecha_hora.toISOString(), tipo: r.tipo });
  }
  // Entrada = primera marca de tipo Entrada, salida = última de tipo Salida; la
  // salida nunca se inventa (mismo criterio que el calendario: `resumirFichadas`).
  const todos = [...mapa.values()]
    .map((d) => {
      const r = resumirFichadas(d.marcas);
      return {
        userId: d.userId,
        nombre: d.nombre,
        fecha: d.fecha,
        entrada: r.entrada,
        salida: r.salida,
        marcas: r.marcas,
        // Sin marca de salida: es la cola de trabajo de RRHH, no un error de datos.
        incompleto: r.salida == null,
      };
    })
    // Mismo criterio que el KPI del Resumen: hoy no cuenta como día sin salida,
    // la jornada todavía está abierta.
    .filter((d) => (f.soloIncompletos ? d.incompleto && d.fecha !== hoy : true))
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : a.nombre.localeCompare(b.nombre)));

  return {
    items: todos.slice((page - 1) * FILAS_POR_PAGINA, page * FILAS_POR_PAGINA),
    total: todos.length,
    page,
    pageSize: FILAS_POR_PAGINA,
    truncado,
  };
}

/**
 * Números del Resumen para un rango. Una sola consulta agregada (groupBy) en vez
 * de traer las fichadas: el JSON que sale de acá es chico aunque el mes tenga
 * decenas de miles de marcas.
 */
export async function resumenAsistencia(f: FiltrosFichadas): Promise<ResumenAsistencia> {
  const where: Prisma.AsistenciaFichadaWhereInput = { fecha: { gte: f.desde, lte: f.hasta } };
  if (f.relojId) where.reloj_id = f.relojId;

  const [grupos, personasRows, relojes, ultima] = await Promise.all([
    prisma.asistenciaFichada.groupBy({
      by: ['user_id', 'fecha', 'tipo'],
      where,
      _count: { _all: true },
    }),
    prisma.asistenciaPersona.findMany({
      include: { empleado: { select: { nombre: true, estado: true } } },
      orderBy: { user_id: 'asc' },
    }),
    listarRelojes(),
    prisma.asistenciaFichada.findFirst({ where, orderBy: { fecha_hora: 'desc' }, select: { fecha_hora: true } }),
  ]);

  const base = armarResumen(
    grupos.map((g) => ({ userId: g.user_id, fecha: g.fecha, tipo: g.tipo, marcas: g._count._all })),
    // Solo las activas: una persona archivada no cuenta en los totales del Resumen.
    personasRows
      .filter((p) => personaActiva({ empleadoId: p.empleado_id, activo: p.activo, empleadoEstado: p.empleado?.estado ?? null }))
      .map((p) => ({
        userId: p.user_id,
        nombre: p.empleado?.nombre || p.nombre_reloj || p.user_id,
        empleadoId: p.empleado_id,
      })),
    { desde: f.desde, hasta: f.hasta },
  );

  const syncs = relojes.map((r) => r.ultimo_sync).filter((s): s is Date => !!s);

  return {
    ...base,
    relojes: {
      total: relojes.length,
      activos: relojes.filter((r) => r.activo).length,
      conError: relojes.filter((r) => r.activo && r.ultimo_error).length,
      ultimoSync: syncs.length ? new Date(Math.max(...syncs.map((d) => d.getTime()))).toISOString() : null,
    },
    ultimaFichada: ultima?.fecha_hora.toISOString() ?? null,
  };
}

/** Nombre a mostrar por user_id (organigrama si está vinculado; si no, nombre del reloj). */
async function nombresPorUserId(userIds: string[]): Promise<Map<string, string>> {
  const unicos = [...new Set(userIds)];
  const personas = await prisma.asistenciaPersona.findMany({
    where: { user_id: { in: unicos } },
    include: { empleado: { select: { nombre: true } } },
  });
  const out = new Map<string, string>();
  for (const p of personas) out.set(p.user_id, p.empleado?.nombre || p.nombre_reloj || p.user_id);
  for (const u of unicos) if (!out.has(u)) out.set(u, u);
  return out;
}

// ─── Export XLSX ─────────────────────────────────────────────────────────────

export async function exportarXlsx(f: FiltrosFichadas): Promise<Buffer> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Fichadas');
  ws.columns = [
    { header: 'Fecha', key: 'fecha', width: 12 },
    { header: 'Hora', key: 'hora', width: 10 },
    { header: 'Legajo/ID', key: 'userId', width: 14 },
    { header: 'Nombre', key: 'nombre', width: 30 },
    { header: 'Reloj', key: 'reloj', width: 18 },
    { header: 'Tipo', key: 'tipo', width: 12 },
    { header: 'Origen', key: 'origen', width: 12 },
  ];
  ws.getRow(1).font = { bold: true };
  const { TIPOS_MARCA } = await import('./asistencia-datos');
  const rows = await prisma.asistenciaFichada.findMany({ where: await whereFichadas(f), orderBy: [{ fecha_hora: 'asc' }] });
  const nombres = await nombresPorUserId(rows.map((r) => r.user_id));
  const relojes = new Map((await prisma.asistenciaReloj.findMany({ select: { id: true, nombre: true } })).map((r) => [r.id, r.nombre]));
  for (const r of rows) {
    const local = new Date(r.fecha_hora.getTime() + OFFSET_RELOJ_MIN * 60_000);
    ws.addRow({
      fecha: r.fecha,
      hora: local.toISOString().slice(11, 19),
      userId: r.user_id,
      nombre: nombres.get(r.user_id) ?? r.user_id,
      reloj: relojes.get(r.reloj_id) ?? `#${r.reloj_id}`,
      tipo: TIPOS_MARCA[r.tipo] ?? `Tipo ${r.tipo}`,
      origen: r.origen,
    });
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Math.trunc(Number(v));
  return null;
}

/** Copia de una fila con las claves en minúscula (tablas del .mdb varían la capitalización). */
function ci(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k in row) out[k.toLowerCase()] = row[k];
  return out;
}

function pick(row: Record<string, unknown>, key: string): unknown {
  return row[key];
}

/**
 * mdb-reader devuelve la fecha de Access (sin zona) como Date cuyos campos UTC
 * son la hora de pared local del reloj. Ese Date NO es el instante real.
 */
function fechaDeMdb(v: unknown): Date | null {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  if (typeof v === 'string') { const d = new Date(v); return isNaN(d.getTime()) ? null : d; }
  return null;
}

/** Instante real (UTC) a partir de la hora de pared local (-03:00), igual que la bajada directa. */
function instanteReal(wall: Date): Date {
  return new Date(wall.getTime() - OFFSET_RELOJ_MIN * 60_000);
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

export { hoyLocal, ClienteAnviz };
