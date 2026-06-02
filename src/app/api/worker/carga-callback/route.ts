import { NextRequest, NextResponse } from 'next/server';
import {
  applyCargaResultado,
  setFacturaCargando,
  type FacturaEstadoCarga,
  type FacturaTipoFlujo,
} from '@/lib/facturas';

interface CargaCallbackPayload {
  factura_id: number | string;
  estado_carga: FacturaEstadoCarga;
  tipo_flujo?: FacturaTipoFlujo | null;
  empresa_destino?: string | null;
  finnegans_numero_interno?: string | null;
  carga_error?: string | null;
  proveedor?: string | null;
  numero_factura?: string | null;
  fecha_emision?: string | null;
  monto_total?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const key = request.headers.get('x-worker-key');
    const secret = process.env.WORKER_SECRET;
    if (!secret || key !== secret) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = (await request.json()) as CargaCallbackPayload;
    if (!body.factura_id || !body.estado_carga) {
      return NextResponse.json(
        { error: 'factura_id y estado_carga requeridos' },
        { status: 400 },
      );
    }

    const id = Number(body.factura_id);

    // estado intermedio: el worker tomó la factura y empezó a procesarla.
    if (body.estado_carga === 'cargando') {
      await setFacturaCargando(id);
      return NextResponse.json({ ok: true });
    }

    const updated = await applyCargaResultado(id, {
      estado_carga: body.estado_carga,
      tipo_flujo: body.tipo_flujo ?? null,
      empresa_destino: body.empresa_destino ?? null,
      finnegans_numero_interno: body.finnegans_numero_interno ?? null,
      carga_error: body.carga_error ?? null,
      proveedor: body.proveedor ?? null,
      numero_factura: body.numero_factura ?? null,
      fecha_emision: body.fecha_emision ?? null,
      monto_total: body.monto_total ?? null,
    });

    if (!updated) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error en POST /api/worker/carga-callback:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
