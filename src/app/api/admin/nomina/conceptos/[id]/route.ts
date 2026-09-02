import { NextRequest, NextResponse } from 'next/server';
import { handle, parseId, parseOrgId, readJson } from '@/lib/nomina-api';
import { deleteConcepto, updateConcepto } from '@/lib/nomina';
import type { Concepto } from '@/lib/nomina-datos';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Ctx) {
  return handle('PUT /api/admin/nomina/conceptos/[id]', async () => {
    const { id } = await params;
    const body = await readJson(request);
    const orgId = parseOrgId(body.organigramaId ?? request.nextUrl.searchParams.get('organigramaId'));
    return NextResponse.json(await updateConcepto(orgId, parseId(id), body as Partial<Concepto>));
  });
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  return handle('DELETE /api/admin/nomina/conceptos/[id]', async () => {
    const { id } = await params;
    const orgId = parseOrgId(request.nextUrl.searchParams.get('organigramaId'));
    await deleteConcepto(orgId, parseId(id));
    return NextResponse.json({ ok: true });
  });
}
