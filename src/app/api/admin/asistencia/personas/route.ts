import { NextResponse } from 'next/server';
import { handle } from '@/lib/asistencia-api';
import { listarPersonas } from '@/lib/asistencia';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handle('GET /api/admin/asistencia/personas', async () =>
    NextResponse.json({ personas: await listarPersonas() }),
  );
}
