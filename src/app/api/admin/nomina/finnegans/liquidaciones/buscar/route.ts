import { NextRequest, NextResponse } from 'next/server';
import { getSessionUsername } from '@/lib/admin-auth';
import { handle, parsePeriodo, readJson } from '@/lib/nomina-api';
import { buscarLiquidaciones } from '@/lib/recibos-finnegans';

/** Consulta RESUMENLIQ del período (1 llamada PAGA a Finnegans) y actualiza el índice. */
export async function POST(request: NextRequest) {
  return handle('POST /api/admin/nomina/finnegans/liquidaciones/buscar', async () => {
    const body = await readJson(request);
    return NextResponse.json(await buscarLiquidaciones(parsePeriodo(body.periodo), await getSessionUsername()));
  });
}
