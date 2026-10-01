import { NextRequest, NextResponse } from 'next/server';
import { handle, parseFiltrosRecibos } from '@/lib/nomina-api';
import { listarCasos } from '@/lib/recibos-finnegans';

export const dynamic = 'force-dynamic';

/** Casos de disconformidad. `estado` = abierto (default) | resuelto | todos; filtros `empleador` y `lugar`. */
export async function GET(request: NextRequest) {
  return handle('GET /api/admin/nomina/firma/casos', async () => {
    const p = request.nextUrl.searchParams;
    const e = p.get('estado');
    const estado = e === 'resuelto' || e === 'todos' ? e : 'abierto';
    return NextResponse.json(await listarCasos(estado, parseFiltrosRecibos(p)));
  });
}
