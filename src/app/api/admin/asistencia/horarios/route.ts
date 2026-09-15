import { NextResponse } from 'next/server';
import { handle, parseId, readJson } from '@/lib/asistencia-api';
import { AsistenciaError } from '@/lib/asistencia';
import { guardarVersionHorario, listarHorarios } from '@/lib/asistencia-horarios';
import { validarHorarioInput } from '@/lib/asistencia-calendario';
import { getSessionUsername } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/** Query opcional: `empleadoId`. Devuelve todas las versiones, la más reciente primero. */
export async function GET(request: Request) {
  return handle('GET /api/admin/asistencia/horarios', async () => {
    const q = new URL(request.url).searchParams;
    const empleadoId = q.get('empleadoId') ? parseId(q.get('empleadoId'), 'empleadoId') : undefined;
    return NextResponse.json({ horarios: await listarHorarios(empleadoId) });
  });
}

/** Body: `HorarioInput` (ver `validarHorarioInput`). Aplica desde `aplicarDesde` sin pisar el pasado. */
export async function POST(request: Request) {
  return handle('POST /api/admin/asistencia/horarios', async () => {
    let input;
    try {
      input = validarHorarioInput(await readJson(request));
    } catch (e) {
      throw new AsistenciaError(e instanceof Error ? e.message : 'Datos inválidos');
    }
    const resultado = await guardarVersionHorario(input, await getSessionUsername());
    return NextResponse.json({ ok: true, ...resultado });
  });
}
