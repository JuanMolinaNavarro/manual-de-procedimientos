import { NextRequest, NextResponse } from 'next/server';
import { getSessionUsername } from '@/lib/admin-auth';
import { handle, parseId, parseOrgId, parsePeriodo, readJson } from '@/lib/nomina-api';
import { otorgarBono } from '@/lib/nomina';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Ctx) {
  return handle('POST /api/admin/nomina/bonos/[id]/otorgar', async () => {
    const { id } = await params;
    const body = await readJson(request);
    const res = await otorgarBono(parseOrgId(body.organigramaId), parseId(id), parsePeriodo(body.periodo), await getSessionUsername());
    return NextResponse.json(res, { status: 201 });
  });
}
