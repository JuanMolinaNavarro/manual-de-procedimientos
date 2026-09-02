import { NextRequest, NextResponse } from 'next/server';
import { handle, parseOrgId } from '@/lib/nomina-api';
import { getRecibos } from '@/lib/nomina';

export async function GET(request: NextRequest) {
  return handle('GET /api/admin/nomina/recibos', async () => {
    return NextResponse.json(await getRecibos(parseOrgId(request.nextUrl.searchParams.get('organigramaId'))));
  });
}
