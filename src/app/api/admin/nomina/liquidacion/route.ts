import { NextRequest, NextResponse } from 'next/server';
import { handle, parseOrgId, parsePeriodo } from '@/lib/nomina-api';
import { getLiquidacion } from '@/lib/nomina';

export async function GET(request: NextRequest) {
  return handle('GET /api/admin/nomina/liquidacion', async () => {
    const q = request.nextUrl.searchParams;
    return NextResponse.json(await getLiquidacion(parseOrgId(q.get('organigramaId')), parsePeriodo(q.get('periodo'))));
  });
}
