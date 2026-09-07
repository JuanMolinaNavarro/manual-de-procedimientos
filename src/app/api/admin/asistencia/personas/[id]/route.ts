import { NextResponse } from 'next/server';
import { handle, parseId, readJson } from '@/lib/asistencia-api';
import { vincularPersona } from '@/lib/asistencia';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle('PATCH /api/admin/asistencia/personas/[id]', async () => {
    const { id } = await params;
    const body = await readJson(request);
    const empleadoId = body.empleadoId == null ? null : parseId(body.empleadoId, 'empleadoId');
    const persona = await vincularPersona(parseId(id), empleadoId);
    return NextResponse.json({ ok: true, persona });
  });
}
