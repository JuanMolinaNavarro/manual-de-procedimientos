import { NextRequest, NextResponse } from 'next/server';
import { getSessionUsername, puedeGestionarPinSesion } from '@/lib/admin-auth';
import { handle, parseId, parseOrgId, readJson } from '@/lib/nomina-api';
import { NominaError, revocarAdhesion } from '@/lib/nomina';

type Ctx = { params: Promise<{ empleadoId: string }> };

/**
 * Revoca la adhesión (baja del recibo digital o renovación porque el trabajador olvidó su
 * PIN). Body opcional: { motivo }. No borra nada: la adhesión y su acta escaneada quedan en el
 * historial (`NominaAdhesionRevocada`), porque respaldan las firmas ya hechas.
 * Solo RR.HH. (admin), nunca el superadmin: revocar + re-adherir con otro PIN permitiría firmar
 * en nombre del trabajador a quien además puede resetearle la contraseña del portal.
 */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  return handle('DELETE /api/admin/nomina/adhesiones/[empleadoId]', async () => {
    if (!(await puedeGestionarPinSesion())) {
      throw new NominaError('Las adhesiones las gestiona RR.HH. (un admin): el superadmin no puede adherir, revocar ni cargar actas', 403);
    }
    const { empleadoId } = await params;
    const orgId = parseOrgId(request.nextUrl.searchParams.get('organigramaId'));
    const body = await readJson(request);
    await revocarAdhesion(orgId, parseId(empleadoId, 'empleadoId'), await getSessionUsername(), body.motivo);
    return NextResponse.json({ ok: true });
  });
}
