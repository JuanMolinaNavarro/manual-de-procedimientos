import { NextRequest, NextResponse } from 'next/server';
import { handle, parseOrgId, parsePeriodo } from '@/lib/nomina-api';
import { listarLiquidaciones } from '@/lib/recibos-finnegans';

export const dynamic = 'force-dynamic';

/**
 * Liquidaciones de Finnegans ya indexadas para un organigrama y período, más el
 * consumo de llamadas pagas del mes. Lee solo la DB: no llama a Finnegans.
 */
export async function GET(request: NextRequest) {
  return handle('GET /api/admin/nomina/finnegans/liquidaciones', async () => {
    const p = request.nextUrl.searchParams;
    return NextResponse.json(await listarLiquidaciones(parseOrgId(p.get('organigramaId')), parsePeriodo(p.get('periodo'))));
  });
}
