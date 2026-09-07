import { NextResponse } from 'next/server';
import { handle } from '@/lib/asistencia-api';
import { vincularPorCuil } from '@/lib/asistencia';

export const dynamic = 'force-dynamic';

export async function POST() {
  return handle('POST /api/admin/asistencia/personas/vincular', async () =>
    NextResponse.json(await vincularPorCuil()),
  );
}
