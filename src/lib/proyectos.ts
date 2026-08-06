/**
 * Capa de datos del módulo Proyectos y finanzas.
 *
 * Todo el acceso a Prisma vive acá; los cálculos están en `proyectos-calc.ts`
 * (puros, compartidos con el cliente) y las constantes en `proyectos-datos.ts`.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import type { ScopeProyectos } from './admin-auth';
import { getPlantilla } from './proyectos-datos';
import {
  avanceEtapas,
  correrEnCascada,
  difDias,
  finCronograma,
  sumarDias,
  type ConfigProyectos,
  type EtapaProyecto,
  type Proyecto,
} from './proyectos-calc';

// ─── Config (singleton id = 1) ───────────────────────────────────────────────

export async function getConfig(): Promise<ConfigProyectos> {
  const anioActual = new Date().getFullYear();
  const row = await prisma.proyectoConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, anio_base: anioActual },
  });
  return { fx_ars: row.fx_ars, infl_usd: row.infl_usd, anio_base: row.anio_base };
}

export async function updateConfig(
  data: Partial<ConfigProyectos>,
  username: string | null,
): Promise<ConfigProyectos> {
  await getConfig(); // garantiza que la fila exista
  const row = await prisma.proyectoConfig.update({
    where: { id: 1 },
    data: {
      ...(data.fx_ars != null ? { fx_ars: data.fx_ars } : {}),
      ...(data.infl_usd != null ? { infl_usd: data.infl_usd } : {}),
      ...(data.anio_base != null ? { anio_base: data.anio_base } : {}),
      updated_by: username,
    },
  });
  return { fx_ars: row.fx_ars, infl_usd: row.infl_usd, anio_base: row.anio_base };
}

// ─── Proyectos ───────────────────────────────────────────────────────────────

/** Solo el nombre del empleado vinculado: alcanza para mostrarlo siempre fresco. */
const SELECT_RESPONSABLE = { select: { id: true, nombre: true, rol: true } } as const;

const INCLUDE_DETALLE = {
  costos: { orderBy: [{ orden: 'asc' }, { id: 'asc' }] },
  etapas: {
    orderBy: [{ orden: 'asc' }, { id: 'asc' }],
    include: { responsable_emp: SELECT_RESPONSABLE },
  },
  responsable_emp: SELECT_RESPONSABLE,
} satisfies Prisma.ProyectoInclude;

type ProyectoRow = Prisma.ProyectoGetPayload<{ include: typeof INCLUDE_DETALLE }>;

/** Descarta timestamps y deja el objeto listo para serializar al cliente. */
function mapProyecto(row: ProyectoRow): Proyecto {
  return {
    id: row.id,
    nombre: row.nombre,
    descripcion: row.descripcion,
    responsable: row.responsable,
    responsable_id: row.responsable_id,
    responsable_nombre: row.responsable_emp?.nombre ?? row.responsable,
    estado: row.estado,
    area: row.area,
    fecha_inicio: row.fecha_inicio,
    notas: row.notas,
    ingreso_estimado: row.ingreso_estimado,
    otros_ingresos: row.otros_ingresos,
    moneda_ingreso: row.moneda_ingreso,
    anio_ingreso: row.anio_ingreso,
    created_by: row.created_by,
    updated_by: row.updated_by,
    costos: row.costos.map((c) => ({
      id: c.id,
      categoria: c.categoria,
      concepto: c.concepto,
      unidad: c.unidad,
      cantidad: c.cantidad,
      costo_unitario: c.costo_unitario,
      moneda: c.moneda,
      etapa_id: c.etapa_id,
      orden: c.orden,
    })),
    etapas: row.etapas.map((t) => ({
      id: t.id,
      nombre: t.nombre,
      responsable: t.responsable,
      responsable_id: t.responsable_id,
      responsable_nombre: t.responsable_emp?.nombre ?? t.responsable,
      fecha_inicio: t.fecha_inicio,
      duracion_dias: t.duracion_dias,
      dep_id: t.dep_id,
      estado: t.estado,
      avance: t.avance,
      orden: t.orden,
      notas: t.notas,
    })),
  };
}

export async function getProyectos(scope?: ScopeProyectos): Promise<Proyecto[]> {
  if (scope?.tipo === 'ninguno') return [];
  const rows = await prisma.proyecto.findMany({
    where: scope?.tipo === 'area' ? { area: scope.area } : undefined,
    include: INCLUDE_DETALLE,
    orderBy: { created_at: 'desc' },
  });
  return rows.map(mapProyecto);
}

export async function getProyectoById(id: number): Promise<Proyecto | null> {
  const row = await prisma.proyecto.findUnique({ where: { id }, include: INCLUDE_DETALLE });
  return row ? mapProyecto(row) : null;
}

/**
 * Como `getProyectoById`, pero devuelve null si el scope del usuario no cubre
 * el área del proyecto (para el detalle y sus rutas API: mismo 404 que si no
 * existiera, sin filtrar la existencia del proyecto).
 */
export async function getProyectoVisible(
  id: number,
  scope: ScopeProyectos,
): Promise<Proyecto | null> {
  if (scope.tipo === 'ninguno') return null;
  const proyecto = await getProyectoById(id);
  if (!proyecto) return null;
  if (scope.tipo === 'area' && proyecto.area !== scope.area) return null;
  return proyecto;
}

export interface CreateProyectoData {
  nombre: string;
  descripcion?: string | null;
  responsable?: string | null;
  responsable_id?: number | null;
  area?: string | null;
  fecha_inicio: string;
  /** Id de PLANTILLAS_CRONOGRAMA con el que se precarga el Gantt. */
  plantilla?: string;
  created_by?: string | null;
}

/** Crea el proyecto y su cronograma inicial, con las etapas encadenadas. */
export async function createProyecto(data: CreateProyectoData): Promise<Proyecto> {
  const cfg = await getConfig();
  const plantilla = getPlantilla(data.plantilla ?? 'estandar');

  const creado = await prisma.$transaction(async (tx): Promise<number> => {
    const p = await tx.proyecto.create({
      data: {
        nombre: data.nombre,
        descripcion: data.descripcion ?? null,
        responsable: data.responsable ?? null,
        responsable_id: data.responsable_id ?? null,
        area: data.area ?? null,
        fecha_inicio: data.fecha_inicio,
        anio_ingreso: cfg.anio_base,
        created_by: data.created_by ?? null,
        updated_by: data.created_by ?? null,
      },
    });

    // Las etapas se crean de a una para poder encadenar dep_id con el id real.
    let offset = 0;
    let anteriorId: number | null = null;
    for (const [i, e] of plantilla.etapas.entries()) {
      // Anotado para cortar la inferencia circular con `anteriorId`.
      const etapa: { id: number } = await tx.proyectoEtapa.create({
        data: {
          proyecto_id: p.id,
          nombre: e.nombre,
          fecha_inicio: sumarDias(data.fecha_inicio, offset),
          duracion_dias: e.dias,
          dep_id: anteriorId,
          orden: i,
        },
      });
      anteriorId = etapa.id;
      offset += e.dias;
    }
    return p.id;
  });

  const proyecto = await getProyectoById(creado);
  if (!proyecto) throw new Error('No se pudo leer el proyecto recién creado');
  return proyecto;
}

export interface UpdateProyectoData {
  nombre?: string;
  descripcion?: string | null;
  responsable?: string | null;
  responsable_id?: number | null;
  area?: string | null;
  estado?: string;
  fecha_inicio?: string;
  notas?: string | null;
  ingreso_estimado?: number;
  otros_ingresos?: number;
  moneda_ingreso?: string;
  anio_ingreso?: number;
  updated_by?: string | null;
}

export async function updateProyecto(
  id: number,
  data: UpdateProyectoData,
): Promise<Proyecto | null> {
  const actual = await prisma.proyecto.findUnique({
    where: { id },
    include: { etapas: true },
  });
  if (!actual) return null;

  const { fecha_inicio, ...resto } = data;

  // Mover la fecha de inicio corre el cronograma completo por el mismo delta.
  if (fecha_inicio && fecha_inicio !== actual.fecha_inicio) {
    const delta = difDias(actual.fecha_inicio, fecha_inicio);
    if (delta) {
      await prisma.$transaction(
        actual.etapas.map((t) =>
          prisma.proyectoEtapa.update({
            where: { id: t.id },
            data: { fecha_inicio: sumarDias(t.fecha_inicio, delta) },
          }),
        ),
      );
    }
  }

  await prisma.proyecto.update({
    where: { id },
    data: { ...resto, ...(fecha_inicio ? { fecha_inicio } : {}) },
  });
  return getProyectoById(id);
}

export async function deleteProyecto(id: number): Promise<void> {
  await prisma.proyecto.delete({ where: { id } });
}

// ─── Vista por persona (para la ficha del organigrama) ───────────────────────

/** Una etapa del proyecto que tiene a cargo la persona consultada. */
export interface EtapaACargo {
  id: number;
  nombre: string;
  estado: string;
  avance: number;
  fecha_inicio: string;
  fecha_fin: string;
}

export interface ProyectoDeEmpleado {
  id: number;
  nombre: string;
  descripcion: string | null;
  estado: string;
  fecha_inicio: string;
  fecha_fin: string;
  /** Avance del proyecto completo, ponderado por duración de etapas. */
  avance: number;
  /** La persona es responsable del proyecto entero. */
  es_responsable: boolean;
  /** Etapas del cronograma a su cargo (puede estar vacío si solo es responsable). */
  etapas_a_cargo: EtapaACargo[];
}

/**
 * Proyectos en los que participa una persona del organigrama: los que tiene a
 * cargo y aquellos donde es responsable de al menos una etapa del cronograma.
 */
export async function getProyectosDeEmpleado(empleadoId: number): Promise<ProyectoDeEmpleado[]> {
  const rows = await prisma.proyecto.findMany({
    where: {
      OR: [
        { responsable_id: empleadoId },
        { etapas: { some: { responsable_id: empleadoId } } },
      ],
    },
    include: { etapas: { orderBy: [{ orden: 'asc' }, { id: 'asc' }] } },
    orderBy: { created_at: 'desc' },
  });

  return rows.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    descripcion: p.descripcion,
    estado: p.estado,
    fecha_inicio: p.fecha_inicio,
    fecha_fin: finCronograma(p.fecha_inicio, p.etapas),
    avance: avanceEtapas(p.etapas),
    es_responsable: p.responsable_id === empleadoId,
    etapas_a_cargo: p.etapas
      .filter((t) => t.responsable_id === empleadoId)
      .map((t) => ({
        id: t.id,
        nombre: t.nombre,
        estado: t.estado,
        avance: t.avance,
        fecha_inicio: t.fecha_inicio,
        fecha_fin: sumarDias(t.fecha_inicio, t.duracion_dias),
      })),
  }));
}

// ─── Costos ──────────────────────────────────────────────────────────────────

export async function addCosto(proyectoId: number) {
  const ultimo = await prisma.proyectoCosto.findFirst({
    where: { proyecto_id: proyectoId },
    orderBy: { orden: 'desc' },
  });
  return prisma.proyectoCosto.create({
    data: {
      proyecto_id: proyectoId,
      categoria: ultimo?.categoria ?? 'General',
      concepto: 'Nuevo ítem',
      unidad: 'unidad',
      cantidad: 1,
      costo_unitario: 0,
      moneda: 'USD',
      orden: (ultimo?.orden ?? -1) + 1,
    },
  });
}

export async function updateCosto(
  id: number,
  data: Partial<{
    categoria: string;
    concepto: string;
    unidad: string;
    cantidad: number;
    costo_unitario: number;
    moneda: string;
    etapa_id: number | null;
  }>,
) {
  return prisma.proyectoCosto.update({ where: { id }, data });
}

export async function deleteCosto(id: number): Promise<void> {
  await prisma.proyectoCosto.delete({ where: { id } });
}

// ─── Etapas ──────────────────────────────────────────────────────────────────

export async function addEtapa(proyectoId: number) {
  const proyecto = await prisma.proyecto.findUnique({
    where: { id: proyectoId },
    include: { etapas: { orderBy: [{ orden: 'asc' }, { id: 'asc' }] } },
  });
  if (!proyecto) throw new Error('Proyecto no encontrado');

  const ultima = proyecto.etapas[proyecto.etapas.length - 1];
  return prisma.proyectoEtapa.create({
    data: {
      proyecto_id: proyectoId,
      nombre: 'Nueva etapa',
      fecha_inicio: ultima
        ? sumarDias(ultima.fecha_inicio, ultima.duracion_dias)
        : proyecto.fecha_inicio,
      duracion_dias: 15,
      dep_id: ultima?.id ?? null,
      orden: (ultima?.orden ?? -1) + 1,
    },
  });
}

export async function updateEtapa(
  id: number,
  data: Partial<{
    nombre: string;
    responsable: string | null;
    responsable_id: number | null;
    duracion_dias: number;
    estado: string;
    avance: number;
    fecha_inicio: string;
    notas: string | null;
  }>,
) {
  const etapa = await prisma.proyectoEtapa.findUnique({ where: { id } });
  if (!etapa) return null;

  const { fecha_inicio, ...resto } = data;

  // Mover una etapa arrastra a las que dependen de ella.
  if (fecha_inicio && fecha_inicio !== etapa.fecha_inicio) {
    await moverEtapa(id, difDias(etapa.fecha_inicio, fecha_inicio));
  }

  // Marcar "hecho" implica 100% de avance; volver a pendiente lo pone en 0.
  if (resto.estado === 'hecho' && resto.avance == null) resto.avance = 100;
  if (resto.estado === 'pendiente' && resto.avance == null) resto.avance = 0;

  if (Object.keys(resto).length === 0) {
    return prisma.proyectoEtapa.findUnique({ where: { id } });
  }
  return prisma.proyectoEtapa.update({ where: { id }, data: resto });
}

/** Corre una etapa `dias` días arrastrando en cascada a sus dependientes. */
export async function moverEtapa(id: number, dias: number) {
  if (!dias) return null;
  const etapa = await prisma.proyectoEtapa.findUnique({ where: { id } });
  if (!etapa) return null;

  const hermanas = await prisma.proyectoEtapa.findMany({
    where: { proyecto_id: etapa.proyecto_id },
  });
  const cambios = correrEnCascada(hermanas as unknown as EtapaProyecto[], id, dias);

  await prisma.$transaction(
    Object.entries(cambios).map(([etapaId, fecha]) =>
      prisma.proyectoEtapa.update({ where: { id: Number(etapaId) }, data: { fecha_inicio: fecha } }),
    ),
  );
  return prisma.proyectoEtapa.findUnique({ where: { id } });
}

export async function deleteEtapa(id: number): Promise<void> {
  // onDelete: SetNull en la auto-relación deja huérfanas a las dependientes (dejan
  // de moverse en cascada) y desimputa los costos que apuntaban a esta etapa.
  await prisma.proyectoEtapa.delete({ where: { id } });
}
