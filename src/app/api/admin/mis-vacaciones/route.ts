import { NextResponse } from 'next/server';
import { VacacionesError, postSeleccion, vista } from '@/lib/vacaciones';
import { conSesion, leerJson } from '@/lib/vacaciones-api';

export const dynamic = 'force-dynamic';

/**
 * Vacaciones del usuario de la sesión: la ficha del organigrama vinculada a su cuenta. No recibe
 * ningún id: cada uno ve y cambia solo lo suyo. Solo sesión (rol `empleado` o admin).
 */
export async function GET(request: Request) {
  return conSesion(request, 'GET /api/admin/mis-vacaciones', false, async ({ usuario }) => {
    if (usuario.empleado_id == null) return NextResponse.json({ vinculado: false, usuario: usuario.usuario });
    return NextResponse.json({ vinculado: true, ...(await vista(usuario.empleado_id, 'portal')) });
  });
}

/** Body `{ accion, ... }`: solo las acciones del portal (elegir, conformidad, enviar, retirar, acusar recibo). */
export async function POST(request: Request) {
  return conSesion(request, 'POST /api/admin/mis-vacaciones', false, async ({ usuario, actor }) => {
    if (usuario.empleado_id == null) throw new VacacionesError('Tu usuario no está vinculado a una ficha', 409);
    return NextResponse.json(await postSeleccion(usuario.empleado_id, await leerJson(request), actor, 'portal'));
  });
}
