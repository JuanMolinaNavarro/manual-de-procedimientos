import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import { join, extname } from 'path';
import {
  createArchivoContrato,
  getArchivosForContratoComprador,
  getArchivosForContratoVendedor,
} from '@/lib/senales-ip';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'senales-ip');

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get('site_session');
  const role = session?.value?.split('|')[1];
  return role === 'admin';
}

async function getUsername(): Promise<string | null> {
  const cookieStore = await cookies();
  const val = cookieStore.get('site_session')?.value;
  return val ? val.split('|')[0] : null;
}

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
    const username = await getUsername();
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
    const ext = extname(file.name);
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
