import { NextRequest, NextResponse } from 'next/server';
import { getUsuarioSesion } from '@/lib/admin-auth';
import { cambiarPinPropio, NominaError } from '@/lib/nomina';
import { handleSesion, readJson } from '@/lib/nomina-api';

/**
 * Cambio de PIN por autogestión (portal del trabajador). Body: { pinActual, pin, pin2 }.
 * La ficha sale SOLO de la sesión. RR.HH. no tiene forma de cambiar PINs.
 */
export async function POST(request: NextRequest) {
  return handleSesion('POST /api/admin/mis-recibos/pin', async () => {
    const usuario = await getUsuarioSesion();
    if (!usuario) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    if (usuario.empleado_id == null) throw new NominaError('Tu usuario no está vinculado a una ficha del organigrama', 409);
    const body = await readJson(request);
    await cambiarPinPropio(
      usuario.empleado_id,
      { pinActual: body.pinActual, pin: body.pin, pin2: body.pin2 },
      { dispositivo: request.headers.get('user-agent') ?? '', usuario: usuario.usuario },
    );
    return NextResponse.json({ ok: true });
  });
}
