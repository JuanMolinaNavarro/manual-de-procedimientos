import { NextResponse } from 'next/server';
import { exigirRango, handle, parseFiltros } from '@/lib/asistencia-api';
import { resumenAsistencia } from '@/lib/asistencia';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handle('GET /api/admin/asistencia/resumen', async () => {
    const f = parseFiltros(new URL(request.url));
    exigirRango(f); // el groupBy recorre el rango entero
    return NextResponse.json(await resumenAsistencia(f));
  });
}
