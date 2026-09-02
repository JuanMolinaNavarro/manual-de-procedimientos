import { NextRequest, NextResponse } from 'next/server';
import { handle, parseOrgId, parsePeriodo, readJson } from '@/lib/nomina-api';
import { reabrirPeriodo } from '@/lib/nomina';

export async function POST(request: NextRequest) {
  return handle('POST /api/admin/nomina/liquidacion/reabrir', async () => {
    const body = await readJson(request);
    return NextResponse.json(await reabrirPeriodo(parseOrgId(body.organigramaId), parsePeriodo(body.periodo)));
  });
}
