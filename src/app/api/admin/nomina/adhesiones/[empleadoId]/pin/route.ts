import { NextRequest, NextResponse } from 'next/server';
import { handle, parseId, parseOrgId, readJson } from '@/lib/nomina-api';
import { cambiarPin } from '@/lib/nomina';

type Ctx = { params: Promise<{ empleadoId: string }> };

export async function PUT(request: NextRequest, { params }: Ctx) {
  return handle('PUT /api/admin/nomina/adhesiones/[empleadoId]/pin', async () => {
    const { empleadoId } = await params;
    const body = await readJson(request);
    const orgId = parseOrgId(body.organigramaId ?? request.nextUrl.searchParams.get('organigramaId'));
    await cambiarPin(orgId, parseId(empleadoId, 'empleadoId'), body.pin, body.pin2);
    return NextResponse.json({ ok: true });
  });
}
