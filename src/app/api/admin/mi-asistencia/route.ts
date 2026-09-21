import { NextResponse } from 'next/server';
import { getUsuarioSesion } from '@/lib/admin-auth';
import { handle, parseMes } from '@/lib/asistencia-api';
import { miAsistencia } from '@/lib/asistencia-horarios';

export const dynamic = 'force-dynamic';

/**
 * Asistencia del usuario de la sesión: la ficha del organigrama vinculada a su
 * cuenta (`Usuario.empleado_id`). No recibe ningún id: cada uno ve solo lo
 * suyo. Query: `mes=yyyy-mm` (default actual).
 */
export async function GET(request: Request) {
  return handle('GET /api/admin/mi-asistencia', async () => {
    const usuario = await getUsuarioSesion();
    if (!usuario) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    if (usuario.empleado_id == null) return NextResponse.json({ vinculado: false, usuario: usuario.usuario });
    const mes = parseMes(new URL(request.url).searchParams.get('mes'));
    return NextResponse.json({ vinculado: true, ...(await miAsistencia(usuario.empleado_id, mes)) });
  });
}
