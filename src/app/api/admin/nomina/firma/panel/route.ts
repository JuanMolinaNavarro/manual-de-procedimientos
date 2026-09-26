import { NextRequest, NextResponse } from 'next/server';
import { handle, parseOrgId, parsePeriodo } from '@/lib/nomina-api';
import { panelRecibos } from '@/lib/recibos-finnegans';

export const dynamic = 'force-dynamic';

/** Panel de RR.HH.: recibos PDF del período con su estado de entrega, firma y caso. */
export async function GET(request: NextRequest) {
  return handle('GET /api/admin/nomina/firma/panel', async () => {
    const p = request.nextUrl.searchParams;
    return NextResponse.json(await panelRecibos(parseOrgId(p.get('organigramaId')), parsePeriodo(p.get('periodo'))));
  });
}
