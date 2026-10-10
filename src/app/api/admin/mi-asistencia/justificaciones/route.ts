import { NextResponse } from 'next/server';
import { getUsuarioSesion } from '@/lib/admin-auth';
import { handleSesion } from '@/lib/asistencia-api';
import { AsistenciaError } from '@/lib/asistencia';
import { crearJustificacion } from '@/lib/asistencia-justificaciones';

export const dynamic = 'force-dynamic';

/**
 * El usuario de la sesión sube el justificativo de un día ausente suyo (multipart: `fecha`,
 * `archivo`, `comentario` opcional). La ficha sale SOLO de la sesión.
 */
export async function POST(request: Request) {
  return handleSesion('POST /api/admin/mi-asistencia/justificaciones', async () => {
    const usuario = await getUsuarioSesion();
    if (!usuario) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    if (usuario.empleado_id == null) throw new AsistenciaError('Tu usuario no está vinculado a una ficha', 409);
    const form = await request.formData();
    const creada = await crearJustificacion(
      usuario.empleado_id,
      { fecha: form.get('fecha'), comentario: form.get('comentario'), archivo: form.get('archivo') },
      usuario.usuario,
    );
    return NextResponse.json(creada, { status: 201 });
  });
}
