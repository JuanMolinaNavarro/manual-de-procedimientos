import { NextRequest, NextResponse } from 'next/server';
import { getSessionUsername } from '@/lib/admin-auth';
import { handle, parseId, readJson } from '@/lib/nomina-api';
import { actualizarCaso } from '@/lib/recibos-finnegans';

/** Anota o resuelve un caso de disconformidad. Body: { notas?, resolver? }. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle('PATCH /api/admin/nomina/firma/casos/[id]', async () => {
    const { id } = await params;
    const body = await readJson(request);
    await actualizarCaso(parseId(id), { notas: body.notas, resolver: body.resolver }, await getSessionUsername());
    return NextResponse.json({ ok: true });
  });
}
