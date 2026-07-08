import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getFacturaById, retryFacturaCarga } from '@/lib/facturas';

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get('site_session');
  const role = session?.value?.split('|')[1];
  return role === 'admin';
}

/**
 * Reintenta la carga de una factura individual: sólo si su estado es Error
 * (`error` o `revision`). La vuelve a `pendiente` para que el worker la retome.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const { id } = await params;
    const factura = await getFacturaById(Number(id));
    if (!factura) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
    }
    if (factura.estado_carga !== 'error' && factura.estado_carga !== 'revision') {
      return NextResponse.json(
        { error: 'Solo se pueden reintentar facturas con estado Error.' },
        { status: 409 },
      );
    }
    const actualizada = await retryFacturaCarga(Number(id));
    if (!actualizada) {
      return NextResponse.json(
        { error: 'No se pudo reencolar la factura para reintento.' },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, factura: actualizada });
  } catch (error) {
    console.error('Error en POST /api/admin/facturas/[id]/reintentar:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
