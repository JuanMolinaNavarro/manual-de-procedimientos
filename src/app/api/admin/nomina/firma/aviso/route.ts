import { NextRequest, NextResponse } from 'next/server';
import { getSessionUsername } from '@/lib/admin-auth';
import { handle, parseOrgId, parsePeriodo, readJson } from '@/lib/nomina-api';
import { enviarAviso, listarAvisos, previaAviso } from '@/lib/recibos-finnegans';

export const dynamic = 'force-dynamic';

/** Quiénes recibirían el aviso del período (y quiénes no, con el motivo) + avisos ya enviados. */
export async function GET(request: NextRequest) {
  return handle('GET /api/admin/nomina/firma/aviso', async () => {
    const p = request.nextUrl.searchParams;
    const orgId = parseOrgId(p.get('organigramaId'));
    const periodo = parsePeriodo(p.get('periodo'));
    const [previa, historial] = await Promise.all([previaAviso(orgId, periodo), listarAvisos(orgId, periodo)]);
    return NextResponse.json({ ...previa, historial });
  });
}

/** Manda el aviso por mail "tus recibos están disponibles" (sin adjuntos). Body: { organigramaId, periodo }. */
export async function POST(request: NextRequest) {
  return handle('POST /api/admin/nomina/firma/aviso', async () => {
    const body = await readJson(request);
    const res = await enviarAviso(parseOrgId(body.organigramaId), parsePeriodo(body.periodo), await getSessionUsername());
    return NextResponse.json(res, { status: 201 });
  });
}
