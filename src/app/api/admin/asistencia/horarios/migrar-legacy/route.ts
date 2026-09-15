import { NextResponse } from 'next/server';
import { handle, readJson } from '@/lib/asistencia-api';
import { migrarHorariosLegacy } from '@/lib/asistencia-horarios';

export const dynamic = 'force-dynamic';

/**
 * Release A: convierte `OrgEmpleado.horario`/`horarios` en versiones de horario.
 * Body `{ dryRun }`. Se borra junto con esas columnas en el Release B.
 */
export async function POST(request: Request) {
  return handle('POST /api/admin/asistencia/horarios/migrar-legacy', async () => {
    const body = await readJson(request);
    return NextResponse.json(await migrarHorariosLegacy(body.dryRun === true));
  });
}
