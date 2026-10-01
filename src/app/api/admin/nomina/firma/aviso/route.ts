import { NextRequest, NextResponse } from 'next/server';
import { getSessionUsername } from '@/lib/admin-auth';
import { handle, parsePeriodo, readJson } from '@/lib/nomina-api';
import { enviarAviso, listarAvisos, previaAviso } from '@/lib/recibos-finnegans';

export const dynamic = 'force-dynamic';

/** Quiénes recibirían el aviso del mes (todos; y quiénes no, con el motivo) + avisos ya enviados. */
export async function GET(request: NextRequest) {
  return handle('GET /api/admin/nomina/firma/aviso', async () => {
    const periodo = parsePeriodo(request.nextUrl.searchParams.get('periodo'));
    const [previa, historial] = await Promise.all([previaAviso(periodo), listarAvisos(periodo)]);
    return NextResponse.json({ ...previa, historial });
  });
}

/** Manda el aviso por mail "tus recibos están disponibles" (sin adjuntos) a todos los del mes. Body: { periodo }. */
export async function POST(request: NextRequest) {
  return handle('POST /api/admin/nomina/firma/aviso', async () => {
    const body = await readJson(request);
    const res = await enviarAviso(parsePeriodo(body.periodo), await getSessionUsername());
    return NextResponse.json(res, { status: 201 });
  });
}
