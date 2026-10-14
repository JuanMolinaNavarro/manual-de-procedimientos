import { NextResponse } from 'next/server';
import { getUsuarioSesion } from '@/lib/admin-auth';
import { handleSesion } from '@/lib/asistencia-api';
import { AsistenciaError } from '@/lib/asistencia';
import { elegirSabadoLibre, quitarSabadoLibre } from '@/lib/asistencia-sabado-libre';

export const dynamic = 'force-dynamic';

/** Ficha del usuario de la sesión (la única que puede tocar). */
async function fichaSesion() {
  const usuario = await getUsuarioSesion();
  if (!usuario) return null;
  if (usuario.empleado_id == null) throw new AsistenciaError('Tu usuario no está vinculado a una ficha', 409);
  return { empleadoId: usuario.empleado_id, usuario: usuario.usuario };
}

/** Body `{ fecha }`: elige (o cambia) el sábado libre del mes en curso. */
export async function POST(request: Request) {
  return handleSesion('POST /api/admin/mi-asistencia/sabado-libre', async () => {
    const f = await fichaSesion();
    if (!f) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = (await request.json().catch(() => null)) as { fecha?: unknown } | null;
    return NextResponse.json(await elegirSabadoLibre(f.empleadoId, body?.fecha, f.usuario));
  });
}

/** Quita el sábado libre del mes en curso. */
export async function DELETE() {
  return handleSesion('DELETE /api/admin/mi-asistencia/sabado-libre', async () => {
    const f = await fichaSesion();
    if (!f) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    await quitarSabadoLibre(f.empleadoId);
    return NextResponse.json({ ok: true });
  });
}
