import { NextResponse } from 'next/server';
import { getUsuarioSesion } from '@/lib/admin-auth';
import { handleSesion, parseId } from '@/lib/asistencia-api';
import { AsistenciaError } from '@/lib/asistencia';
import { archivoJustificacion } from '@/lib/asistencia-justificaciones';
import { headersArchivo } from '@/lib/archivos';

export const dynamic = 'force-dynamic';

/** El documento de un justificativo propio; uno ajeno o inexistente es 404. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleSesion('GET /api/admin/mi-asistencia/justificaciones/[id]/archivo', async () => {
    const usuario = await getUsuarioSesion();
    if (!usuario) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    if (usuario.empleado_id == null) throw new AsistenciaError('Justificativo no encontrado', 404);
    const f = await archivoJustificacion(parseId((await params).id), usuario.empleado_id);
    return new NextResponse(new Uint8Array(f.buffer), { headers: headersArchivo(f.archivo, { nombreDescarga: f.nombre, cache: 'private, no-store' }) });
  });
}
