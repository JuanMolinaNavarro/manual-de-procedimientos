import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getFacturaById } from '@/lib/facturas';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'facturas');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Accepts admin cookie OR X-Worker-Key header (for the worker to download the file)
    const cookieStore = await cookies();
    const session = cookieStore.get('site_session');
    const role = session?.value?.split('|')[1];
    const workerKey = request.headers.get('x-worker-key');
    const workerSecret = process.env.WORKER_SECRET;
    const isAuthed =
      role === 'admin' ||
      (workerSecret != null && workerKey === workerSecret);

    if (!isAuthed) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const factura = await getFacturaById(Number(id));
    if (!factura) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
    }

    let buffer: Buffer;
    try {
      buffer = readFileSync(join(UPLOAD_DIR, factura.nombre_archivo));
    } catch {
      return NextResponse.json({ error: 'Archivo no encontrado en disco' }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${factura.nombre_original}"`,
      },
    });
  } catch (error) {
    console.error('Error en GET /api/admin/facturas/[id]/archivo:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
