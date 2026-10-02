import { NextRequest, NextResponse } from 'next/server';
import { handle, parseId } from '@/lib/nomina-api';
import { getActaDatos } from '@/lib/nomina';

export async function GET(request: NextRequest) {
  return handle('GET /api/admin/nomina/acta-datos', async () => {
    return NextResponse.json(await getActaDatos(parseId(request.nextUrl.searchParams.get('empleadoId'), 'empleadoId')));
  });
}
