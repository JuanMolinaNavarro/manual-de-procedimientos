import { NextRequest, NextResponse } from 'next/server';
import { getUsuarioSesion } from '@/lib/admin-auth';
import { handleSesion } from '@/lib/nomina-api';
import { reciboPropio } from '@/lib/recibos-finnegans';

export const dynamic = 'force-dynamic';

/**
 * PDF de un recibo propio. La ficha sale SOLO de la sesión; un recibo ajeno o
 * inexistente responde 404. `?descargar=1` lo baja como adjunto.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleSesion('GET /api/admin/mis-recibos/[id]/pdf', async () => {
    const usuario = await getUsuarioSesion();
    if (!usuario) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    if (usuario.empleado_id == null) return NextResponse.json({ error: 'Recibo no encontrado' }, { status: 404 });
    const { id } = await params;
    const { pdf, nombre } = await reciboPropio(usuario.empleado_id, id);
    const modo = request.nextUrl.searchParams.get('descargar') === '1' ? 'attachment' : 'inline';
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${modo}; filename="${nombre}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  });
}
