import { NextRequest, NextResponse } from 'next/server';
import { getSessionUsername } from '@/lib/admin-auth';
import { handle, parseOrgId, parsePeriodo, readJson } from '@/lib/nomina-api';
import { cerrarPeriodo } from '@/lib/nomina';

export async function POST(request: NextRequest) {
  return handle('POST /api/admin/nomina/liquidacion/cerrar', async () => {
    const body = await readJson(request);
    const res = await cerrarPeriodo(parseOrgId(body.organigramaId), parsePeriodo(body.periodo), await getSessionUsername());
    return NextResponse.json(res, { status: 201 });
  });
}
