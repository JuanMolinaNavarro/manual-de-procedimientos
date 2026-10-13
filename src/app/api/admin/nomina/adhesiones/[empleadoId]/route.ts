import { NextRequest, NextResponse } from 'next/server';
import { actorDe } from '@/lib/auditoria';
import { handle, parseId, readJson } from '@/lib/nomina-api';
import { revocarAdhesion } from '@/lib/nomina';

type Ctx = { params: Promise<{ empleadoId: string }> };

/**
 * Revoca la adhesión (baja del recibo digital o renovación porque el trabajador olvidó su
 * PIN). Body opcional: { motivo }. No borra nada: la adhesión y su acta escaneada quedan en el
 * historial (`NominaAdhesionRevocada`), porque respaldan las firmas ya hechas.
 * Queda en `auditoria` quién la revocó.
 */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  return handle('DELETE /api/admin/nomina/adhesiones/[empleadoId]', async () => {
    const { empleadoId } = await params;
    const body = await readJson(request);
    await revocarAdhesion(parseId(empleadoId, 'empleadoId'), await actorDe(request), body.motivo);
    return NextResponse.json({ ok: true });
  });
}
