import { NextResponse } from 'next/server';
import { handle, parseId, parseMes } from '@/lib/asistencia-api';
import { perfilPersona } from '@/lib/asistencia-horarios';

export const dynamic = 'force-dynamic';

/** Query: `mes=yyyy-mm` (default actual). Resumen del mes de una persona para liquidar. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle('GET /api/admin/asistencia/personas/[id]/perfil', async () => {
    const { id } = await params;
    const q = new URL(request.url).searchParams;
    return NextResponse.json(await perfilPersona(parseId(id), parseMes(q.get('mes'))));
  });
}
