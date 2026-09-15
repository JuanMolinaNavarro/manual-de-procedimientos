import { NextResponse } from 'next/server';
import { handle, parseId } from '@/lib/asistencia-api';
import { borrarUltimaVersion } from '@/lib/asistencia-horarios';
import { getSessionUsername } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/** Deshace la última versión del empleado; reabre la anterior si esta la había cerrado. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle('DELETE /api/admin/asistencia/horarios/[id]', async () => {
    const { id } = await params;
    const resultado = await borrarUltimaVersion(parseId(id), await getSessionUsername());
    return NextResponse.json({ ok: true, ...resultado });
  });
}
