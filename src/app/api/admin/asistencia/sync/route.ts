import { NextResponse } from 'next/server';
import { handle, readJson } from '@/lib/asistencia-api';
import { sincronizarTodos } from '@/lib/asistencia';
import type { ModoDescarga } from '@/lib/asistencia-datos';

export const dynamic = 'force-dynamic';
export const maxDuration = 600;

export async function POST(request: Request) {
  return handle('POST /api/admin/asistencia/sync', async () => {
    const b = await readJson(request);
    const modo: ModoDescarga = b.modo === 'todos' ? 'todos' : 'nuevos';
    return NextResponse.json({ resultados: await sincronizarTodos(modo) });
  });
}
