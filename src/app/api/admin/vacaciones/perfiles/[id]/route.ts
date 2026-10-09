import { NextResponse } from 'next/server';
import { guardarPerfil, idEntero } from '@/lib/vacaciones';
import { readJson } from '@/lib/api-admin';
import { conSesion } from '@/lib/vacaciones-api';

export const dynamic = 'force-dynamic';

/** Ficha de vacaciones de una persona (cambio parcial). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return conSesion(request, 'PATCH /api/admin/vacaciones/perfiles/[id]', true, async (s) => {
    await guardarPerfil(idEntero((await params).id), await readJson(request), s.actor, s.verSueldos);
    return NextResponse.json({ ok: true });
  });
}
