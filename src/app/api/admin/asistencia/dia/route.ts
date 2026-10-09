import { NextResponse } from 'next/server';
import { handle, parseFecha } from '@/lib/asistencia-api';
import { tableroDia } from '@/lib/asistencia-tablero';

export const dynamic = 'force-dynamic';

/** Query: `fecha=yyyy-mm-dd` (default hoy). Cómo vino cada persona con horario ese día y el día anterior. */
export async function GET(request: Request) {
  return handle('GET /api/admin/asistencia/dia', async () => {
    const q = new URL(request.url).searchParams;
    return NextResponse.json(await tableroDia(parseFecha(q.get('fecha'))));
  });
}
