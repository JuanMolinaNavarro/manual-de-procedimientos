import { NextRequest, NextResponse } from 'next/server';
import { getUsuarioSesion } from '@/lib/admin-auth';
import { NominaError } from '@/lib/nomina';
import { handleSesion, readJson } from '@/lib/nomina-api';
import { firmarRecibo } from '@/lib/recibos-finnegans';
import { ipCliente } from '@/lib/login-limite';

/**
 * Firma de un recibo propio desde el portal (celular del trabajador): usuario de la sesión +
 * PIN. Body: { pin, conformidad, observaciones, leido }. La ficha sale SOLO de la sesión.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleSesion('POST /api/admin/mis-recibos/[id]/firmar', async () => {
    const usuario = await getUsuarioSesion();
    if (!usuario) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    if (usuario.empleado_id == null) throw new NominaError('Recibo no encontrado', 404);
    const { id } = await params;
    const body = await readJson(request);
    const constancia = await firmarRecibo(usuario.empleado_id, id, {
      pin: body.pin,
      conformidad: body.conformidad,
      observaciones: body.observaciones,
      leido: body.leido,
      dispositivo: request.headers.get('user-agent') ?? '',
      // La que ve el proxy inverso (no la primera de X-Forwarded-For, que la escribe el cliente).
      ip: ipCliente(request.headers),
    });
    return NextResponse.json(constancia, { status: 201 });
  });
}
