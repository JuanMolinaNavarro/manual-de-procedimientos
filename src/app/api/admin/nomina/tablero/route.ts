import { NextRequest, NextResponse } from 'next/server';
import { handle, parseOrgId, parsePeriodo } from '@/lib/nomina-api';
import { getTablero } from '@/lib/nomina';

export async function GET(request: NextRequest) {
  return handle('GET /api/admin/nomina/tablero', async () => {
    const q = request.nextUrl.searchParams;
    return NextResponse.json(await getTablero(parseOrgId(q.get('organigramaId')), parsePeriodo(q.get('periodo'))));
  });
}
