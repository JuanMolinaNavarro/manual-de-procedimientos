import { NextRequest, NextResponse } from 'next/server';
import { handle, parseFiltrosRecibos } from '@/lib/nomina-api';
import { getRecibos } from '@/lib/nomina';

/** Adhesiones (todas las personas con CUIL; filtros `empleador` y `lugar`) + integridad de las cadenas. */
export async function GET(request: NextRequest) {
  return handle('GET /api/admin/nomina/recibos', async () => {
    return NextResponse.json(await getRecibos(parseFiltrosRecibos(request.nextUrl.searchParams)));
  });
}
