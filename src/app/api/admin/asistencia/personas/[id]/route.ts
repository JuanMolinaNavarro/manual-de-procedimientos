import { NextResponse } from 'next/server';
import { handle, parseId, readJson } from '@/lib/asistencia-api';
import { AsistenciaError, setPersonaActiva, vincularPersona } from '@/lib/asistencia';

export const dynamic = 'force-dynamic';

/** Body: `{ empleadoId }` para (des)vincular, o `{ activa }` para prender/apagar. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle('PATCH /api/admin/asistencia/personas/[id]', async () => {
    const { id } = await params;
    const body = await readJson(request);

    if ('activa' in body) {
      if (typeof body.activa !== 'boolean') throw new AsistenciaError('activa debe ser true o false');
      const persona = await setPersonaActiva(parseId(id), body.activa);
      return NextResponse.json({ ok: true, persona });
    }

    if ('empleadoId' in body) {
      const empleadoId = body.empleadoId == null ? null : parseId(body.empleadoId, 'empleadoId');
      const persona = await vincularPersona(parseId(id), empleadoId);
      return NextResponse.json({ ok: true, persona });
    }

    throw new AsistenciaError('Nada que actualizar: mandá empleadoId o activa');
  });
}
