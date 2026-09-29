import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import { join, extname } from 'path';
import {
  createArchivoContrato,
  getArchivosForContratoComprador,
  getArchivosForContratoVendedor,
} from '@/lib/senales-ip';
import { getSessionUsername, isAdmin } from '@/lib/admin-auth';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'senales-ip');
const ARCHIVO_MAX_BYTES = 25 * 1024 * 1024;
// Extensión saneada: se sirve siempre como descarga, pero el nombre en disco no debe traer basura.
const EXT_RE = /^\.[a-z0-9]{1,8}$/;

export async function GET(request: NextRequest) {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const compradorId = request.nextUrl.searchParams.get('contrato_comprador_id');
    const vendedorId = request.nextUrl.searchParams.get('contrato_vendedor_id');
    if (compradorId) {
      return NextResponse.json(await getArchivosForContratoComprador(Number(compradorId)));
    }
    if (vendedorId) {
      return NextResponse.json(await getArchivosForContratoVendedor(Number(vendedorId)));
    }
    return NextResponse.json({ error: 'Se requiere contrato_comprador_id o contrato_vendedor_id' }, { status: 400 });
  } catch (error) {
    console.error('Error en GET /api/admin/senales-ip/archivos:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const username = await getSessionUsername();
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 });
    }
    const compradorId = formData.get('contrato_comprador_id');
    const vendedorId = formData.get('contrato_vendedor_id');
    if (!compradorId && !vendedorId) {
      return NextResponse.json(
        { error: 'Se requiere contrato_comprador_id o contrato_vendedor_id' },
        { status: 400 },
      );
    }
    if (file.size > ARCHIVO_MAX_BYTES) {
      return NextResponse.json({ error: 'El archivo no puede superar 25 MB' }, { status: 400 });
    }
    const extCliente = extname(file.name).toLowerCase();
    const ext = EXT_RE.test(extCliente) ? extCliente : '';
    const storedName = `${randomUUID()}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    mkdirSync(UPLOAD_DIR, { recursive: true });
    writeFileSync(join(UPLOAD_DIR, storedName), buffer);
    const archivo = await createArchivoContrato({
      contrato_comprador_id: compradorId ? Number(compradorId) : null,
      contrato_vendedor_id: vendedorId ? Number(vendedorId) : null,
      nombre_original: file.name,
      nombre_archivo: storedName,
      tipo_mime: file.type || null,
      tamano: file.size,
      created_by: username,
    });
    return NextResponse.json(archivo, { status: 201 });
  } catch (error) {
    console.error('Error en POST /api/admin/senales-ip/archivos:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
