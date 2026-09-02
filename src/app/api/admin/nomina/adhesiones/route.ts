import { NextRequest, NextResponse } from 'next/server';
import { getSessionUsername } from '@/lib/admin-auth';
import { handle, parseId, parseOrgId, readJson } from '@/lib/nomina-api';
import { adherir } from '@/lib/nomina';

export async function POST(request: NextRequest) {
  return handle('POST /api/admin/nomina/adhesiones', async () => {
    const body = await readJson(request);
    const res = await adherir(parseOrgId(body.organigramaId), parseId(body.empleadoId, 'empleadoId'), body.modo, body.pin, body.pin2, await getSessionUsername());
    return NextResponse.json(res, { status: 201 });
  });
}
