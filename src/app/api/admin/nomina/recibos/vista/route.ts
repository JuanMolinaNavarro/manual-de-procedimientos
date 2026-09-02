import { NextRequest, NextResponse } from 'next/server';
import { handle, parseId, parseOrgId, parsePeriodo } from '@/lib/nomina-api';
import { getReciboVista } from '@/lib/nomina';

export async function GET(request: NextRequest) {
  return handle('GET /api/admin/nomina/recibos/vista', async () => {
    const q = request.nextUrl.searchParams;
    return NextResponse.json(await getReciboVista(parseOrgId(q.get('organigramaId')), parsePeriodo(q.get('periodo')), parseId(q.get('empleadoId'), 'empleadoId')));
  });
}
