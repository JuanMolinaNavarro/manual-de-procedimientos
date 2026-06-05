import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getAllFacturas, createFactura } from '@/lib/facturas';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'facturas');

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

export async function GET() {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    return NextResponse.json(await getAllFacturas());
  } catch (error) {
    console.error('Error en GET /api/admin/facturas:', error);
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
    const files = formData
      .getAll('file')
      .filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 });
    }
    if (files.some((f) => f.type !== 'application/pdf')) {
      return NextResponse.json({ error: 'Solo se aceptan archivos PDF' }, { status: 400 });
    }

    mkdirSync(UPLOAD_DIR, { recursive: true });

    // estado_carga='pendiente' (default): el worker Python las toma por polling,
    // las extrae y las carga en FinnegansGO.
    const creadas = [];
    for (const file of files) {
      const storedName = `${randomUUID()}.pdf`;
      const buffer = Buffer.from(await file.arrayBuffer());
      writeFileSync(join(UPLOAD_DIR, storedName), buffer);
      const factura = await createFactura({
        nombre_original: file.name,
        nombre_archivo: storedName,
        tipo_mime: file.type,
        tamano: file.size,
        created_by: username,
      });
      creadas.push(factura);
    }

    return NextResponse.json(creadas, { status: 201 });
  } catch (error) {
    console.error('Error en POST /api/admin/facturas:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
