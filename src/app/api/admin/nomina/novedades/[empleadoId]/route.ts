import { NextRequest, NextResponse } from 'next/server';
import { getSessionUsername } from '@/lib/admin-auth';
import { handle, parseId, parseOrgId, parsePeriodo, readJson } from '@/lib/nomina-api';
import { updateNovedad } from '@/lib/nomina';
import type { Novedad } from '@/lib/nomina-datos';

type Ctx = { params: Promise<{ empleadoId: string }> };

export async function PUT(request: NextRequest, { params }: Ctx) {
  return handle('PUT /api/admin/nomina/novedades/[empleadoId]', async () => {
    const { empleadoId } = await params;
    const body = await readJson(request);
    const orgId = parseOrgId(body.organigramaId ?? request.nextUrl.searchParams.get('organigramaId'));
    const periodo = parsePeriodo(body.periodo ?? request.nextUrl.searchParams.get('periodo'));
    return NextResponse.json(await updateNovedad(orgId, parseId(empleadoId, 'empleadoId'), periodo, body as Partial<Novedad>, await getSessionUsername()));
  });
}
