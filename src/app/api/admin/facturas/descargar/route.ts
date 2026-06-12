import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { readFileSync } from 'fs';
import { join } from 'path';
import JSZip from 'jszip';
import { getFacturasByIds } from '@/lib/facturas';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'facturas');

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get('site_session');
  const role = session?.value?.split('|')[1];
  return role === 'admin';
}

/**
 * POST /api/admin/facturas/descargar
 * Body: { ids: number[] }  — IDs de las facturas (la lista ya filtrada en el cliente).
 * Devuelve un ZIP con los PDFs de esas facturas. Los archivos que no estén en
 * disco se omiten; si ninguno existe, responde 404.
 */
export async function POST(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const ids: number[] = Array.isArray(body?.ids)
      ? body.ids.filter((n: unknown): n is number => Number.isInteger(n))
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: 'No se recibieron facturas para descargar' }, { status: 400 });
    }

    const facturas = await getFacturasByIds(ids);
    if (facturas.length === 0) {
      return NextResponse.json({ error: 'No se encontraron las facturas' }, { status: 404 });
    }

    const zip = new JSZip();
    const usados = new Set<string>();
    let agregados = 0;

    for (const f of facturas) {
      let buffer: Buffer;
      try {
        buffer = readFileSync(join(UPLOAD_DIR, f.nombre_archivo));
      } catch {
        // Archivo no está en disco — se omite del ZIP.
        continue;
      }
      // Prefijo con el id para garantizar nombres únicos (varias facturas pueden
      // compartir nombre_original).
      let nombre = `${f.id}_${f.nombre_original}`;
      if (usados.has(nombre)) nombre = `${f.id}_${agregados}_${f.nombre_original}`;
      usados.add(nombre);
      zip.file(nombre, new Uint8Array(buffer));
      agregados++;
    }

    if (agregados === 0) {
      return NextResponse.json(
        { error: 'Ninguna de las facturas seleccionadas tiene el archivo en disco' },
        { status: 404 },
      );
    }

    const content = await zip.generateAsync({ type: 'nodebuffer' });
    const fecha = new Date().toISOString().slice(0, 10);

    return new NextResponse(new Uint8Array(content), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="facturas_${fecha}.zip"`,
      },
    });
  } catch (error) {
    console.error('Error en POST /api/admin/facturas/descargar:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
