import { NextResponse } from 'next/server';
import { handle, parseId } from '@/lib/asistencia-api';
import { probarReloj } from '@/lib/asistencia';

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle('POST /api/admin/asistencia/relojes/[id]/probar', async () => {
    const { id } = await params;
    return NextResponse.json({ ok: true, ...(await probarReloj(parseId(id))) });
  });
}
