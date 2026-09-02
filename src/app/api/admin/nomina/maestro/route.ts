import { NextRequest, NextResponse } from 'next/server';
import { handle, parseOrgId } from '@/lib/nomina-api';
import { getMaestro } from '@/lib/nomina';

export async function GET(request: NextRequest) {
  return handle('GET /api/admin/nomina/maestro', async () => {
    return NextResponse.json(await getMaestro(parseOrgId(request.nextUrl.searchParams.get('organigramaId'))));
  });
}
