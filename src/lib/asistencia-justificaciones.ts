/**
 * Justificativos de inasistencias. El empleado sube un documento (certificado médico, de
 * examen…) para un día ausente desde Mi asistencia; RR.HH. lo ve, marca los días que cubre y
 * lo aprueba, o lo rechaza con un motivo. El estado del día no se guarda: `calendarioRango` lee
 * las aprobadas y `evaluarDia` deriva «justificado». Un pedido por día (`@@unique`): un rechazo
 * es definitivo (decisión del usuario).
 */

import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { AsistenciaError } from './asistencia';
import { FECHA_RE, hoyLocal } from './asistencia-datos';
import { JUSTIFICACION_APROBADA, calendarioRango, justificarDesde } from './asistencia-horarios';
import { diaJustificable, type CeldaDia, type DiaCalendario } from './asistencia-calendario';
import { extensionDocumento } from './archivos';
import { sha256 } from './nomina-hash';
import { diffDias, rangoMes } from './fechas';

const DIR = join(process.cwd(), 'uploads', 'asistencia', 'justificaciones');
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_TEXTO = 500;
/** Un justificativo cubre a lo sumo dos meses de días (un reposo largo se pide en dos). */
const MAX_DIAS_RANGO = 62;

export type EstadoJustificacion = 'pendiente' | 'aprobada' | 'rechazada';

export interface JustificacionView {
  id: number;
  empleado: { id: number; nombre: string; area: string; fotoArchivo: string | null };
  fecha: string;
  comentario: string | null;
  nombreOriginal: string;
  esImagen: boolean;
  estado: EstadoJustificacion;
  dias: string[];
  motivoRechazo: string | null;
  revisadoPor: string | null;
  revisadoEn: string | null;
  creado: string;
}

const INCLUDE = { empleado: { select: { id: true, nombre: true, area: true, foto_archivo: true } } } as const;
type Row = Prisma.AsistenciaJustificacionGetPayload<{ include: typeof INCLUDE }>;

function aView(r: Row): JustificacionView {
  return {
    id: r.id,
    empleado: { id: r.empleado.id, nombre: r.empleado.nombre, area: r.empleado.area, fotoArchivo: r.empleado.foto_archivo },
    fecha: r.fecha,
    comentario: r.comentario,
    nombreOriginal: r.nombre_original,
    esImagen: !r.nombre_archivo.endsWith('.pdf'),
    estado: r.estado as EstadoJustificacion,
    dias: r.dias,
    motivoRechazo: r.motivo_rechazo,
    revisadoPor: r.revisado_por,
    revisadoEn: r.revisado_en?.toISOString() ?? null,
    creado: r.created_at.toISOString(),
  };
}

function texto(v: unknown, nombre: string): string | null {
  if (v == null) return null;
  if (typeof v !== 'string') throw new AsistenciaError(`${nombre} inválido`);
  const t = v.trim();
  if (t.length > MAX_TEXTO) throw new AsistenciaError(`${nombre}: hasta ${MAX_TEXTO} caracteres`);
  return t || null;
}

/** Celdas de un empleado en un rango (vacío si no tiene horario: no hay nada que justificar). */
async function celdasDe(empleadoId: number, desde: string, hasta: string): Promise<{ dias: DiaCalendario[]; celdas: CeldaDia[] }> {
  const cal = await calendarioRango(desde, hasta, false, `e:${empleadoId}`);
  return { dias: cal.dias, celdas: cal.filas[0]?.celdas ?? [] };
}

// ─── Empleado ────────────────────────────────────────────────────────────────

export async function crearJustificacion(
  empleadoId: number,
  input: { fecha: unknown; comentario: unknown; archivo: unknown },
  usuario: string,
): Promise<JustificacionView> {
  const fecha = typeof input.fecha === 'string' && FECHA_RE.test(input.fecha) ? input.fecha : null;
  if (!fecha) throw new AsistenciaError('Fecha inválida');
  if (fecha < justificarDesde()) throw new AsistenciaError('Ese día ya no se puede justificar: solo los del mes en curso y del anterior');
  if (fecha >= hoyLocal()) throw new AsistenciaError('Solo se justifican días que ya pasaron');
  const comentario = texto(input.comentario, 'El comentario');
  const file = input.archivo;
  if (!(file instanceof File) || !file.size) throw new AsistenciaError('Falta el documento');
  if (file.size > MAX_BYTES) throw new AsistenciaError('El documento supera los 10 MB');
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = extensionDocumento(buffer);
  if (!ext) throw new AsistenciaError('El documento tiene que ser un PDF o una foto (JPG, PNG o WEBP)');

  const [celda] = (await celdasDe(empleadoId, fecha, fecha)).celdas;
  if (celda?.estado !== 'ausente') throw new AsistenciaError('Ese día no figura como inasistencia', 409);

  const archivo = `${randomUUID()}${ext}`;
  mkdirSync(DIR, { recursive: true });
  writeFileSync(join(DIR, archivo), buffer);
  try {
    const row = await prisma.asistenciaJustificacion.create({
      data: {
        empleado_id: empleadoId, fecha, comentario, nombre_original: file.name.slice(0, 200) || `justificativo${ext}`,
        nombre_archivo: archivo, tamano: buffer.length, sha256: sha256(buffer), created_by: usuario,
      },
      include: INCLUDE,
    });
    return aView(row);
  } catch (e) {
    try { unlinkSync(join(DIR, archivo)); } catch { /* puede no existir */ }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new AsistenciaError('Ya enviaste un justificativo para ese día', 409);
    }
    throw e;
  }
}

// ─── RR.HH. ──────────────────────────────────────────────────────────────────

export async function listarJustificaciones(estado: 'pendiente' | 'resueltas'): Promise<JustificacionView[]> {
  const rows = await prisma.asistenciaJustificacion.findMany({
    where: estado === 'pendiente' ? { estado: 'pendiente' } : { estado: { in: ['aprobada', 'rechazada'] } },
    include: INCLUDE,
    orderBy: estado === 'pendiente' ? { created_at: 'asc' } : { revisado_en: 'desc' },
    take: estado === 'pendiente' ? undefined : 100,
  });
  return rows.map(aView);
}

async function buscar(id: number): Promise<Row> {
  const row = await prisma.asistenciaJustificacion.findUnique({ where: { id }, include: INCLUDE });
  if (!row) throw new AsistenciaError('Justificativo no encontrado', 404);
  return row;
}

/** El pedido y el mes del empleado (por default el del día pedido), para marcar los días que cubre. */
export async function detalleJustificacion(id: number, mes: string | null) {
  const row = await buscar(id);
  const { desde, hasta } = rangoMes(mes ?? row.fecha.slice(0, 7));
  return { justificacion: aView(row), ...(await celdasDe(row.empleado_id, desde, hasta)) };
}

type Revisor = { usuario: string; empleadoId: number | null };

/** Nadie revisa su propio pedido, y solo se resuelve uno pendiente. */
async function paraResolver(id: number, revisor: Revisor): Promise<Row> {
  const row = await buscar(id);
  if (revisor.empleadoId === row.empleado_id) throw new AsistenciaError('No podés revisar tu propio justificativo', 403);
  if (row.estado !== 'pendiente') throw new AsistenciaError('Ese justificativo ya se resolvió', 409);
  return row;
}

async function guardarResolucion(id: number, data: Prisma.AsistenciaJustificacionUpdateManyMutationInput): Promise<JustificacionView> {
  const { count } = await prisma.asistenciaJustificacion.updateMany({ where: { id, estado: 'pendiente' }, data });
  if (!count) throw new AsistenciaError('Ese justificativo ya se resolvió', 409);
  return aView(await buscar(id));
}

export async function aprobarJustificacion(id: number, diasInput: unknown, revisor: Revisor): Promise<JustificacionView> {
  const row = await paraResolver(id, revisor);
  if (!Array.isArray(diasInput) || !diasInput.every((d) => typeof d === 'string' && FECHA_RE.test(d))) throw new AsistenciaError('Días inválidos');
  const dias = [...new Set(diasInput as string[])].sort();
  if (!dias.length) throw new AsistenciaError('Marcá al menos un día');
  const [desde, hasta] = [dias[0], dias[dias.length - 1]];
  if (diffDias(desde, hasta) >= MAX_DIAS_RANGO) throw new AsistenciaError(`Un justificativo cubre hasta ${MAX_DIAS_RANGO} días seguidos`);
  const { celdas } = await celdasDe(row.empleado_id, desde, hasta);
  const porFecha = new Map(celdas.map((c) => [c.fecha, c]));
  const malos = dias.filter((d) => { const c = porFecha.get(d); return !c || !diaJustificable(c); });
  if (malos.length) throw new AsistenciaError(`No se pueden justificar: ${malos.join(', ')} (tiene marcas, no le tocaba venir o ya está justificado)`, 409);
  return guardarResolucion(id, { estado: JUSTIFICACION_APROBADA, dias, revisado_por: revisor.usuario, revisado_en: new Date() });
}

export async function rechazarJustificacion(id: number, motivoInput: unknown, revisor: Revisor): Promise<JustificacionView> {
  await paraResolver(id, revisor);
  const motivo = texto(motivoInput, 'El motivo');
  if (!motivo) throw new AsistenciaError('Escribí el motivo del rechazo: el empleado lo va a leer');
  return guardarResolucion(id, { estado: 'rechazada', motivo_rechazo: motivo, revisado_por: revisor.usuario, revisado_en: new Date() });
}

// ─── Archivo ─────────────────────────────────────────────────────────────────

/** El documento, verificado contra su hash. Con `empleadoId` (portal), uno ajeno es 404. */
export async function archivoJustificacion(id: number, empleadoId?: number): Promise<{ buffer: Buffer; archivo: string; nombre: string }> {
  const row = await prisma.asistenciaJustificacion.findUnique({ where: { id } });
  if (!row || (empleadoId != null && row.empleado_id !== empleadoId)) throw new AsistenciaError('Justificativo no encontrado', 404);
  let buffer: Buffer;
  try {
    buffer = readFileSync(join(DIR, row.nombre_archivo));
  } catch {
    throw new AsistenciaError('El documento no está disponible', 404);
  }
  if (sha256(buffer) !== row.sha256) throw new AsistenciaError('El documento guardado no coincide con el original', 409);
  return { buffer, archivo: row.nombre_archivo, nombre: row.nombre_original };
}
