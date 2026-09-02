import { NextRequest, NextResponse } from 'next/server';
import { handle, parseId, parseOrgId } from '@/lib/nomina-api';
import { getActaDatos } from '@/lib/nomina';

export async function GET(request: NextRequest) {
  return handle('GET /api/admin/nomina/acta-datos', async () => {
    const q = request.nextUrl.searchParams;
    return NextResponse.json(await getActaDatos(parseOrgId(q.get('organigramaId')), parseId(q.get('empleadoId'), 'empleadoId')));
  });
}
