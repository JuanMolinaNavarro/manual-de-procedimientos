import { NextRequest, NextResponse } from 'next/server';
import { handle, parseOrgId } from '@/lib/nomina-api';
import { getHistorico } from '@/lib/nomina';

export async function GET(request: NextRequest) {
  return handle('GET /api/admin/nomina/historico', async () => {
    return NextResponse.json(await getHistorico(parseOrgId(request.nextUrl.searchParams.get('organigramaId'))));
  });
}
