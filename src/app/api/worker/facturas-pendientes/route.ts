import { NextRequest, NextResponse } from 'next/server';
import { getFacturasPendientesCarga } from '@/lib/facturas';

export async function GET(request: NextRequest) {
  try {
    const key = request.headers.get('x-worker-key');
    const secret = process.env.WORKER_SECRET;
    if (!secret || key !== secret) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const facturas = await getFacturasPendientesCarga();
    const items = facturas.map((f) => ({
      factura_id: f.id,
      nombre_original: f.nombre_original,
      nombre_archivo: f.nombre_archivo,
      empresa_destino: f.empresa_destino,
    }));
    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error en GET /api/worker/facturas-pendientes:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
