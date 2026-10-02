import { NextRequest, NextResponse } from 'next/server';
import { handle, parseFiltrosRecibos, parsePeriodo } from '@/lib/nomina-api';
import { panelRecibos } from '@/lib/recibos-finnegans';

export const dynamic = 'force-dynamic';

/** Panel de RR.HH.: recibos PDF del período con su estado de entrega, firma y caso. Filtros `empleador` y `lugar`. */
export async function GET(request: NextRequest) {
  return handle('GET /api/admin/nomina/firma/panel', async () => {
    const p = request.nextUrl.searchParams;
    return NextResponse.json(await panelRecibos(parsePeriodo(p.get('periodo')), parseFiltrosRecibos(p)));
  });
}
