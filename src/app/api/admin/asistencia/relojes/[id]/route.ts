import { NextResponse } from 'next/server';
import { handle, parseId, readJson } from '@/lib/asistencia-api';
import { actualizarReloj, borrarReloj } from '@/lib/asistencia';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle('PATCH /api/admin/asistencia/relojes/[id]', async () => {
    const { id } = await params;
    const b = await readJson(request);
    const reloj = await actualizarReloj(parseId(id), {
      nombre: b.nombre != null ? String(b.nombre) : undefined,
      ip: b.ip != null ? String(b.ip) : undefined,
      puerto: b.puerto != null ? Number(b.puerto) : undefined,
      device_id: b.device_id != null ? Number(b.device_id) : undefined,
      activo: b.activo != null ? Boolean(b.activo) : undefined,
      limpiar_nuevos: b.limpiar_nuevos != null ? Boolean(b.limpiar_nuevos) : undefined,
    });
    return NextResponse.json({ ok: true, reloj });
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle('DELETE /api/admin/asistencia/relojes/[id]', async () => {
    const { id } = await params;
    await borrarReloj(parseId(id));
    return NextResponse.json({ ok: true });
  });
}
