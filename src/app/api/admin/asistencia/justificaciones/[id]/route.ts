import { NextResponse } from 'next/server';
import { getUsuarioSesion } from '@/lib/admin-auth';
import { handle, parseId, readJson } from '@/lib/asistencia-api';
import { AsistenciaError } from '@/lib/asistencia';
import { aprobarJustificacion, detalleJustificacion, rechazarJustificacion } from '@/lib/asistencia-justificaciones';
import { MES_RE } from '@/lib/fechas';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** El pedido con el mes del empleado (`?mes=yyyy-mm`, default el del día pedido) para marcar los días. */
export async function GET(request: Request, { params }: Ctx) {
  return handle('GET /api/admin/asistencia/justificaciones/[id]', async () => {
    const mes = new URL(request.url).searchParams.get('mes');
    if (mes != null && !MES_RE.test(mes)) throw new AsistenciaError('Mes inválido (yyyy-mm)');
    return NextResponse.json(await detalleJustificacion(parseId((await params).id), mes));
  });
}

/** `{ accion: 'aprobar', dias: ['yyyy-mm-dd', …] }` | `{ accion: 'rechazar', motivo }`. */
export async function PATCH(request: Request, { params }: Ctx) {
  return handle('PATCH /api/admin/asistencia/justificaciones/[id]', async () => {
    const id = parseId((await params).id);
    const body = await readJson(request);
    const usuario = (await getUsuarioSesion())!;
    const revisor = { usuario: usuario.usuario, empleadoId: usuario.empleado_id };
    if (body.accion === 'aprobar') return NextResponse.json(await aprobarJustificacion(id, body.dias, revisor));
    if (body.accion === 'rechazar') return NextResponse.json(await rechazarJustificacion(id, body.motivo, revisor));
    throw new AsistenciaError('Acción inválida');
  });
}
