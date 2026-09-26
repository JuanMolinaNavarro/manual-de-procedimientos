import { NextRequest, NextResponse } from 'next/server';
import { getSessionUsername, puedeGestionarPinSesion } from '@/lib/admin-auth';
import { handle, parseId, parseOrgId, readJson } from '@/lib/nomina-api';
import { NominaError, adherir } from '@/lib/nomina';

export async function POST(request: NextRequest) {
  return handle('POST /api/admin/nomina/adhesiones', async () => {
    if (!(await puedeGestionarPinSesion())) {
      throw new NominaError('Las adhesiones las gestiona RR.HH. (un admin): el superadmin no puede adherir, revocar ni cargar actas', 403);
    }
    const body = await readJson(request);
    const res = await adherir(parseOrgId(body.organigramaId), parseId(body.empleadoId, 'empleadoId'), body.email, body.pin, body.pin2, await getSessionUsername());
    return NextResponse.json(res, { status: 201 });
  });
}
