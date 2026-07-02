/**
 * Padrón de abonados por empresa (importado desde Excel) para control de duplicados.
 *
 * Se ejecuta SOLO en el servidor. Cada empresa tiene su propio padrón; la carga
 * reemplaza el padrón de la empresa seleccionada y usa un parser en streaming
 * (bajo consumo de memoria) para soportar archivos grandes (~700k filas).
 * La búsqueda es por empresa y filtra por documento, nombre y/o domicilio, con
 * paginación.
 */
import ExcelJS from 'exceljs';
import { Readable } from 'stream';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const BATCH = 2000;

function toStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    v = (o.text ?? o.result ?? o.hyperlink ?? '') as unknown;
  }
  const t = String(v).trim();
  return t === '' ? null : t;
}

interface PadronRowInput {
  empresa: string;
  codigo: string | null;
  nombre_completo: string | null;
  estado: string | null;
  domicilio: string | null;
  domicilio_info_adic: string | null;
  documento_numero: string | null;
}

/**
 * Reemplaza el padrón de UNA empresa con el contenido del Excel.
 * Estructura esperada (fila 1 = encabezado):
 *   Codigo | NombreCompleto | Estado Cod. | Dom. Inst. | Dom.Inst.info.Adic | Documento Numero
 */
export async function cargarPadronDesdeBuffer(
  empresa: string,
  buffer: Buffer,
): Promise<{ total: number }> {
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(Readable.from(buffer), {
    worksheets: 'emit',
    sharedStrings: 'cache',
    styles: 'ignore',
    hyperlinks: 'ignore',
  });

  // Reemplazo total del padrón de esta empresa.
  await prisma.padronAbonado.deleteMany({ where: { empresa } });

  let total = 0;
  let batch: PadronRowInput[] = [];

  const flush = async () => {
    if (batch.length === 0) return;
    await prisma.padronAbonado.createMany({ data: batch });
    total += batch.length;
    batch = [];
  };

  for await (const worksheet of reader) {
    for await (const row of worksheet) {
      if (row.number === 1) continue; // encabezado
      const v = row.values as unknown[]; // 1-indexado (v[0] es undefined)
      const codigo = toStr(v[1]);
      const documento = toStr(v[6]);
      if (codigo === null && documento === null) continue; // fila vacía
      batch.push({
        empresa,
        codigo,
        nombre_completo: toStr(v[2]),
        estado: toStr(v[3]),
        domicilio: toStr(v[4]),
        domicilio_info_adic: toStr(v[5]),
        documento_numero: documento,
      });
      if (batch.length >= BATCH) await flush();
    }
  }
  await flush();
  return { total };
}

/** Cantidad de abonados cargados por empresa: { [empresa]: total }. */
export async function contarPadronPorEmpresa(): Promise<Record<string, number>> {
  const grupos = await prisma.padronAbonado.groupBy({
    by: ['empresa'],
    _count: { _all: true },
  });
  const out: Record<string, number> = {};
  for (const g of grupos) out[g.empresa] = g._count._all;
  return out;
}

export interface BusquedaPadronParams {
  empresa: string;
  dni?: string;
  nombre?: string;
  domicilio?: string;
  page?: number;
}

/** Busca en el padrón de una empresa por documento, nombre y/o domicilio (paginado). */
export async function buscarPadron(params: BusquedaPadronParams, pageSize = 10) {
  const and: Prisma.PadronAbonadoWhereInput[] = [{ empresa: params.empresa }];
  const dni = params.dni?.trim();
  const nombre = params.nombre?.trim();
  const domicilio = params.domicilio?.trim();

  if (dni) and.push({ documento_numero: { contains: dni } });
  if (nombre) and.push({ nombre_completo: { contains: nombre, mode: 'insensitive' } });
  if (domicilio) and.push({ domicilio: { contains: domicilio, mode: 'insensitive' } });

  const where: Prisma.PadronAbonadoWhereInput = { AND: and };
  const page = Math.max(1, params.page ?? 1);

  const [total, items] = await Promise.all([
    prisma.padronAbonado.count({ where }),
    prisma.padronAbonado.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { nombre_completo: 'asc' },
    }),
  ]);

  return { total, items, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
