import { NextResponse } from 'next/server';
import { getUsuarioSesion } from '@/lib/admin-auth';
import { handleSesion } from '@/lib/nomina-api';
import { reciboParaFirmar } from '@/lib/recibos-finnegans';
import { miAdhesion } from '@/lib/nomina';

export const dynamic = 'force-dynamic';

/** Datos de un recibo propio para la pantalla de firma. Ajeno o inexistente → 404. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleSesion('GET /api/admin/mis-recibos/[id]', async () => {
    const usuario = await getUsuarioSesion();
    if (!usuario) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    if (usuario.empleado_id == null) return NextResponse.json({ error: 'Recibo no encontrado' }, { status: 404 });
    const { id } = await params;
    const [recibo, adhesion] = await Promise.all([reciboParaFirmar(usuario.empleado_id, id), miAdhesion(usuario.empleado_id)]);
    return NextResponse.json({ ...recibo, adhesion: adhesion.estado });
  });
}
