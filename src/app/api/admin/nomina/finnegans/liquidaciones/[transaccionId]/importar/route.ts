import { NextRequest, NextResponse } from 'next/server';
import { getSessionUsername } from '@/lib/admin-auth';
import { handle, parseId } from '@/lib/nomina-api';
import { importarLiquidacion } from '@/lib/recibos-finnegans';

// Bajar y partir una sábana grande puede tardar.
export const maxDuration = 120;

/**
 * Importa los recibos de una liquidación: baja la sábana (1 llamada PAGA, salvo que
 * ya esté guardada), la concilia y publica un PDF por persona. Con diferencias no
 * publica nada y devuelve la lista.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ transaccionId: string }> }) {
  return handle('POST /api/admin/nomina/finnegans/liquidaciones/[transaccionId]/importar', async () => {
    const { transaccionId } = await params;
    const res = await importarLiquidacion(parseId(transaccionId, 'transaccionId'), await getSessionUsername());
    // Con diferencias también es 200: es un resultado de negocio (`ok: false` + la lista), no un error.
    return NextResponse.json(res);
  });
}
