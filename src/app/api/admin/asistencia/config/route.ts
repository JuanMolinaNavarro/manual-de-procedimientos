import { NextResponse } from 'next/server';
import { handle, readJson } from '@/lib/asistencia-api';
import { AsistenciaError } from '@/lib/asistencia';
import { getConfigAsistencia, setConfigAsistencia } from '@/lib/asistencia-horarios';
import { validarConfigInput } from '@/lib/asistencia-calendario';
import { getSessionUsername } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handle('GET /api/admin/asistencia/config', async () => NextResponse.json(await getConfigAsistencia()));
}

/** Body: `{ toleranciaMin, tardeGraveMin }`. */
export async function PUT(request: Request) {
  return handle('PUT /api/admin/asistencia/config', async () => {
    let cfg;
    try {
      cfg = validarConfigInput(await readJson(request));
    } catch (e) {
      throw new AsistenciaError(e instanceof Error ? e.message : 'Parámetros inválidos');
    }
    return NextResponse.json(await setConfigAsistencia(cfg, await getSessionUsername()));
  });
}
