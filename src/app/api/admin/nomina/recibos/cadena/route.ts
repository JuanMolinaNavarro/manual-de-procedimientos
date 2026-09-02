import { NextRequest, NextResponse } from 'next/server';
import { handle, parseOrgId } from '@/lib/nomina-api';
import { verificarCadenaOrg } from '@/lib/nomina';

export async function GET(request: NextRequest) {
  return handle('GET /api/admin/nomina/recibos/cadena', async () => {
    return NextResponse.json(await verificarCadenaOrg(parseOrgId(request.nextUrl.searchParams.get('organigramaId'))));
  });
}
