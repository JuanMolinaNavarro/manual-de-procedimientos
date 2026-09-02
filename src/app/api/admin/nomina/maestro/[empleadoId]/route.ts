import { NextRequest, NextResponse } from 'next/server';
import { getSessionUsername } from '@/lib/admin-auth';
import { handle, parseId, parseOrgId, readJson } from '@/lib/nomina-api';
import { updateMaestro } from '@/lib/nomina';
import type { Maestro } from '@/lib/nomina-datos';

type Ctx = { params: Promise<{ empleadoId: string }> };

export async function PUT(request: NextRequest, { params }: Ctx) {
  return handle('PUT /api/admin/nomina/maestro/[empleadoId]', async () => {
    const { empleadoId } = await params;
    const body = await readJson(request);
    const orgId = parseOrgId(body.organigramaId ?? request.nextUrl.searchParams.get('organigramaId'));
    return NextResponse.json(await updateMaestro(orgId, parseId(empleadoId, 'empleadoId'), body as Partial<Maestro>, await getSessionUsername()));
  });
}
