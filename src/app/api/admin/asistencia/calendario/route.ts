import { NextResponse } from 'next/server';
import { handle, parseMes } from '@/lib/asistencia-api';
import { calendarioMes } from '@/lib/asistencia-horarios';

export const dynamic = 'force-dynamic';

/** Query: `mes=yyyy-mm` (default actual), `sinHorario=1` para listar también a quien no tiene horario. */
export async function GET(request: Request) {
  return handle('GET /api/admin/asistencia/calendario', async () => {
    const q = new URL(request.url).searchParams;
    return NextResponse.json(await calendarioMes(parseMes(q.get('mes')), q.get('sinHorario') === '1'));
  });
}
