import { NextResponse } from 'next/server';
import { handle, readJson } from '@/lib/asistencia-api';
import { archivarSilenciosas, AsistenciaError } from '@/lib/asistencia';
import { DIAS_SILENCIO_DEFAULT } from '@/lib/asistencia-datos';

export const dynamic = 'force-dynamic';

/** Body: `{ dias?, simular? }`. Con `simular: true` solo devuelve cuántas serían. */
export async function POST(request: Request) {
  return handle('POST /api/admin/asistencia/personas/archivar', async () => {
    const body = await readJson(request);
    const dias = body.dias == null ? DIAS_SILENCIO_DEFAULT : Number(body.dias);
    if (!Number.isInteger(dias) || dias < 30) throw new AsistenciaError('dias debe ser un entero de al menos 30');
    return NextResponse.json(await archivarSilenciosas(dias, body.simular === true));
  });
}
