import { NextRequest, NextResponse } from 'next/server';
import { handle, parseOrgId, readJson } from '@/lib/nomina-api';
import { addBono, getBonos } from '@/lib/nomina';

export async function GET(request: NextRequest) {
  return handle('GET /api/admin/nomina/bonos', async () => {
    return NextResponse.json(await getBonos(parseOrgId(request.nextUrl.searchParams.get('organigramaId'))));
  });
}

export async function POST(request: NextRequest) {
  return handle('POST /api/admin/nomina/bonos', async () => {
    const body = await readJson(request);
    return NextResponse.json(await addBono(parseOrgId(body.organigramaId)), { status: 201 });
  });
}
