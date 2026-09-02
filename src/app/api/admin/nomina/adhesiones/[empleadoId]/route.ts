import { NextRequest, NextResponse } from 'next/server';
import { unlinkSync } from 'fs';
import { join } from 'path';
import { handle, parseId, parseOrgId } from '@/lib/nomina-api';
import { revocarAdhesion } from '@/lib/nomina';
import { ACTAS_DIR } from '@/lib/nomina-actas';

type Ctx = { params: Promise<{ empleadoId: string }> };

export async function DELETE(request: NextRequest, { params }: Ctx) {
  return handle('DELETE /api/admin/nomina/adhesiones/[empleadoId]', async () => {
    const { empleadoId } = await params;
    const orgId = parseOrgId(request.nextUrl.searchParams.get('organigramaId'));
    const { actaArchivo } = await revocarAdhesion(orgId, parseId(empleadoId, 'empleadoId'));
    if (actaArchivo) {
      try { unlinkSync(join(ACTAS_DIR, actaArchivo)); } catch { /* el archivo puede no existir */ }
    }
    return NextResponse.json({ ok: true });
  });
}
