import { NextResponse } from 'next/server';
import { getUsuarioSesion } from '@/lib/admin-auth';
import { handleSesion } from '@/lib/nomina-api';
import { constanciaPropia } from '@/lib/recibos-finnegans';

export const dynamic = 'force-dynamic';

/** Constancia de firma de un recibo propio (portal). Ajeno o inexistente → 404. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleSesion('GET /api/admin/mis-recibos/[id]/constancia', async () => {
    const usuario = await getUsuarioSesion();
    if (!usuario) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    if (usuario.empleado_id == null) return NextResponse.json({ error: 'Recibo no encontrado' }, { status: 404 });
    const { id } = await params;
    return NextResponse.json({ constancia: await constanciaPropia(usuario.empleado_id, id) });
  });
}
