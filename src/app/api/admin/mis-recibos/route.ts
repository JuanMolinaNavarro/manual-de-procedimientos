import { NextResponse } from 'next/server';
import { getUsuarioSesion } from '@/lib/admin-auth';
import { handleSesion } from '@/lib/nomina-api';
import { misRecibos } from '@/lib/recibos-finnegans';
import { miAdhesion } from '@/lib/nomina';

export const dynamic = 'force-dynamic';

/**
 * Recibos de sueldo del usuario de la sesión (la ficha vinculada a su cuenta).
 * No recibe ningún id: cada uno ve solo lo suyo. Solo sesión (rol `empleado` o admin).
 */
export async function GET() {
  return handleSesion('GET /api/admin/mis-recibos', async () => {
    const usuario = await getUsuarioSesion();
    if (!usuario) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    if (usuario.empleado_id == null || !usuario.empleado) {
      return NextResponse.json({ vinculado: false, usuario: usuario.usuario });
    }
    return NextResponse.json({
      vinculado: true,
      empleado: { id: usuario.empleado.id, nombre: usuario.empleado.nombre },
      recibos: await misRecibos(usuario.empleado_id),
      adhesion: await miAdhesion(usuario.empleado_id),
    });
  });
}
