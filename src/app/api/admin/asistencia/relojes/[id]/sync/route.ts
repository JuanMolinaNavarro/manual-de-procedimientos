import { NextResponse } from 'next/server';
import { handle, parseId, readJson } from '@/lib/asistencia-api';
import { sincronizarReloj } from '@/lib/asistencia';
import type { ModoDescarga } from '@/lib/asistencia-datos';

export const dynamic = 'force-dynamic';
export const maxDuration = 600;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle('POST /api/admin/asistencia/relojes/[id]/sync', async () => {
    const { id } = await params;
    const b = await readJson(request);
    const modo: ModoDescarga = b.modo === 'todos' ? 'todos' : 'nuevos';
    return NextResponse.json({ resultado: await sincronizarReloj(parseId(id), modo) });
  });
}
