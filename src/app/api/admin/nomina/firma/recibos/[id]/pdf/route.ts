import { NextRequest } from 'next/server';
import { handle, pdfResponse } from '@/lib/nomina-api';
import { pdfReciboAdmin } from '@/lib/recibos-finnegans';

export const dynamic = 'force-dynamic';

/** PDF del recibo para el panel de RR.HH. Verifica el hash: si el archivo cambió, 409. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle('GET /api/admin/nomina/firma/recibos/[id]/pdf', async () => {
    const { id } = await params;
    const { pdf, nombre } = await pdfReciboAdmin(id);
    return pdfResponse(pdf, nombre, request.nextUrl.searchParams.get('descargar') === '1');
  });
}
