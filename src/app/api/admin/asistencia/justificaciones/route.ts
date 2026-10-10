import { NextResponse } from 'next/server';
import { handle } from '@/lib/asistencia-api';
import { listarJustificaciones } from '@/lib/asistencia-justificaciones';

export const dynamic = 'force-dynamic';

/** Justificativos de inasistencias. Query: `estado=pendiente` (default) | `resueltas` (últimos 100). */
export async function GET(request: Request) {
  return handle('GET /api/admin/asistencia/justificaciones', async () => {
    const estado = new URL(request.url).searchParams.get('estado') === 'resueltas' ? 'resueltas' : 'pendiente';
    return NextResponse.json(await listarJustificaciones(estado));
  });
}
