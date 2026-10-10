import { NextResponse } from 'next/server';
import { handle, parseId } from '@/lib/asistencia-api';
import { archivoJustificacion } from '@/lib/asistencia-justificaciones';
import { headersArchivo } from '@/lib/archivos';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle('GET /api/admin/asistencia/justificaciones/[id]/archivo', async () => {
    const f = await archivoJustificacion(parseId((await params).id));
    return new NextResponse(new Uint8Array(f.buffer), { headers: headersArchivo(f.archivo, { nombreDescarga: f.nombre, cache: 'private, no-store' }) });
  });
}
