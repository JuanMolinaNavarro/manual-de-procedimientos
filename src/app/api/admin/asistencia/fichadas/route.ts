import { NextResponse } from 'next/server';
import { handle, parseFiltros } from '@/lib/asistencia-api';
import { listarFichadas, resumenPorDia } from '@/lib/asistencia';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handle('GET /api/admin/asistencia/fichadas', async () => {
    const url = new URL(request.url);
    const f = parseFiltros(url);
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    if (url.searchParams.get('vista') === 'dia') {
      return NextResponse.json({ vista: 'dia', ...(await resumenPorDia(f, page)) });
    }
    return NextResponse.json({ vista: 'detalle', ...(await listarFichadas(f, page)) });
  });
}
