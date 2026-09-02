import { NextRequest, NextResponse } from 'next/server';
import { handle, parseOrgId, readJson } from '@/lib/nomina-api';
import { addConcepto, getConceptos } from '@/lib/nomina';

export async function GET(request: NextRequest) {
  return handle('GET /api/admin/nomina/conceptos', async () => {
    return NextResponse.json(await getConceptos(parseOrgId(request.nextUrl.searchParams.get('organigramaId'))));
  });
}

export async function POST(request: NextRequest) {
  return handle('POST /api/admin/nomina/conceptos', async () => {
    const body = await readJson(request);
    return NextResponse.json(await addConcepto(parseOrgId(body.organigramaId)), { status: 201 });
  });
}
