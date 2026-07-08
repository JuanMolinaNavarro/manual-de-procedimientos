import { prisma } from '@/lib/prisma';

export type FacturaEstadoCarga =
  | 'pendiente'
  | 'cargando'
  | 'cargada'
  | 'duplicada'
  | 'error'
  | 'revision';

export type FacturaTipoFlujo =
  | 'arrendamiento_soportes'
  | 'energia_electrica'
  | 'recaudacion'
  | 'recaudacion_sepsa';

export type FacturaTipoServicio =
  | 'electricidad'
  | 'gas'
  | 'internet'
  | 'telefono'
  | 'agua'
  | 'impuesto'
  | 'otro';

export interface Factura {
  id: number;
  nombre_original: string;
  nombre_archivo: string;
  tipo_mime: string | null;
  tamano: number | null;
  proveedor: string | null;
  numero_factura: string | null;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  monto_total: string | null;
  monto_iva: string | null;
  tipo_servicio: FacturaTipoServicio | null;
  periodo: string | null;
  error_mensaje: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  tipo_flujo: FacturaTipoFlujo | null;
  empresa_destino: string | null;
  estado_carga: FacturaEstadoCarga;
  finnegans_numero_interno: string | null;
  carga_error: string | null;
  carga_intentos: number;
  carga_at: Date | null;
}

export interface CreateFacturaData {
  nombre_original: string;
  nombre_archivo: string;
  tipo_mime?: string | null;
  tamano?: number | null;
  created_by?: string | null;
}

export async function getAllFacturas(): Promise<Factura[]> {
  const rows = await prisma.factura.findMany({ orderBy: { id: 'desc' } });
  return rows as unknown as Factura[];
}

export async function getFacturaById(id: number): Promise<Factura | null> {
  const row = await prisma.factura.findUnique({ where: { id } });
  return row as unknown as Factura | null;
}

export async function getFacturasByIds(ids: number[]): Promise<Factura[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.factura.findMany({
    where: { id: { in: ids } },
    orderBy: { id: 'desc' },
  });
  return rows as unknown as Factura[];
}

export async function createFactura(data: CreateFacturaData): Promise<Factura> {
  const row = await prisma.factura.create({
    data: {
      nombre_original: data.nombre_original,
      nombre_archivo: data.nombre_archivo,
      tipo_mime: data.tipo_mime ?? null,
      tamano: data.tamano ?? null,
      created_by: data.created_by ?? null,
    },
  });
  return row as unknown as Factura;
}

export interface CargaResultado {
  estado_carga: FacturaEstadoCarga;
  tipo_flujo?: FacturaTipoFlujo | null;
  empresa_destino?: string | null;
  finnegans_numero_interno?: string | null;
  carga_error?: string | null;
  // datos de display extraídos por el worker
  proveedor?: string | null;
  numero_factura?: string | null;
  fecha_emision?: string | null;
  monto_total?: string | null;
}

/** Facturas listas para que el worker las cargue en FinnegansGO. */
export async function getFacturasPendientesCarga(): Promise<Factura[]> {
  const rows = await prisma.factura.findMany({
    where: { estado_carga: 'pendiente' },
    orderBy: { id: 'asc' },
  });
  return rows as unknown as Factura[];
}

export async function setFacturaCargando(id: number): Promise<void> {
  await prisma.factura.update({
    where: { id },
    data: { estado_carga: 'cargando' },
  });
}

export async function applyCargaResultado(
  id: number,
  resultado: CargaResultado,
): Promise<Factura | null> {
  try {
    const row = await prisma.factura.update({
      where: { id },
      data: {
        estado_carga: resultado.estado_carga,
        tipo_flujo: resultado.tipo_flujo ?? undefined,
        empresa_destino: resultado.empresa_destino ?? undefined,
        finnegans_numero_interno: resultado.finnegans_numero_interno ?? undefined,
        carga_error: resultado.carga_error ?? null,
        proveedor: resultado.proveedor ?? undefined,
        numero_factura: resultado.numero_factura ?? undefined,
        fecha_emision: resultado.fecha_emision ?? undefined,
        monto_total: resultado.monto_total ?? undefined,
        carga_at: new Date(),
        ...(resultado.estado_carga === 'error'
          ? { carga_intentos: { increment: 1 } }
          : {}),
      },
    });
    return row as unknown as Factura;
  } catch {
    return null;
  }
}

/**
 * Reintenta la carga de una factura que quedó en `error`/`revision`: la vuelve a
 * `pendiente` para que el worker la retome en su próximo ciclo, limpiando el
 * resultado del intento anterior. Devuelve la factura actualizada, o `null` si el
 * estado actual no es reintentable (no está en Error) o falla la actualización.
 */
export async function retryFacturaCarga(id: number): Promise<Factura | null> {
  try {
    const actual = await prisma.factura.findUnique({ where: { id } });
    if (!actual) return null;
    if (actual.estado_carga !== 'error' && actual.estado_carga !== 'revision') {
      return null;
    }
    const row = await prisma.factura.update({
      where: { id },
      data: {
        estado_carga: 'pendiente',
        carga_error: null,
        finnegans_numero_interno: null,
        carga_at: null,
      },
    });
    return row as unknown as Factura;
  } catch {
    return null;
  }
}

export async function deleteFactura(id: number): Promise<boolean> {
  try {
    await prisma.factura.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}
