import { NextRequest, NextResponse } from 'next/server';
import { actorDe } from '@/lib/auditoria';
import { handle, parseId, readJson } from '@/lib/nomina-api';
import { adherir } from '@/lib/nomina';

export async function POST(request: NextRequest) {
  return handle('POST /api/admin/nomina/adhesiones', async () => {
    const body = await readJson(request);
    const res = await adherir(parseId(body.empleadoId, 'empleadoId'), body.email, body.pin, body.pin2, await actorDe(request));
    return NextResponse.json(res, { status: 201 });
  });
}
