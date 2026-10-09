import { NextResponse } from 'next/server';
import { handle, parseMes } from '@/lib/asistencia-api';
import { tableroMes } from '@/lib/asistencia-tablero';

export const dynamic = 'force-dynamic';

/** Query: `mes=yyyy-mm` (default actual). Resumen del mes de cada persona con horario, para liquidar. */
export async function GET(request: Request) {
  return handle('GET /api/admin/asistencia/mes', async () => {
    const q = new URL(request.url).searchParams;
    return NextResponse.json(await tableroMes(parseMes(q.get('mes'))));
  });
}
