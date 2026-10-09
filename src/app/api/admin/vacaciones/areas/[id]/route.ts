import { NextResponse } from 'next/server';
import { guardarArea, idEntero } from '@/lib/vacaciones';
import { conSesion, leerJson } from '@/lib/vacaciones-api';

export const dynamic = 'force-dynamic';

/** Cobertura de un área del organigrama: cupo, segundo, semanas y reglas (cambio parcial). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return conSesion(request, 'PATCH /api/admin/vacaciones/areas/[id]', true, async (s) => {
    await guardarArea(idEntero((await params).id), await leerJson(request), s.actor);
    return NextResponse.json({ ok: true });
  });
}
