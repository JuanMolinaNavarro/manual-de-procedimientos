import { NextRequest, NextResponse } from 'next/server';
import { handle, parsePeriodo } from '@/lib/nomina-api';
import { listarLiquidaciones } from '@/lib/recibos-finnegans';

export const dynamic = 'force-dynamic';

/**
 * Liquidaciones de Finnegans ya indexadas para el período (todas las empresas), más el
 * consumo de llamadas pagas del mes. Lee solo la DB: no llama a Finnegans.
 */
export async function GET(request: NextRequest) {
  return handle('GET /api/admin/nomina/finnegans/liquidaciones', async () => {
    return NextResponse.json(await listarLiquidaciones(parsePeriodo(request.nextUrl.searchParams.get('periodo'))));
  });
}
