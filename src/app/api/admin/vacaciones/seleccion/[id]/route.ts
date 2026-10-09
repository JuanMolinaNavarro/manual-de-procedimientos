import { NextResponse } from 'next/server';
import { idEntero, postSeleccion, vista } from '@/lib/vacaciones';
import { conSesion, leerJson } from '@/lib/vacaciones-api';

export const dynamic = 'force-dynamic';

/** Selección de una persona, vista por RR.HH. (carga en su nombre, aprobación, aviso, interrupciones). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return conSesion(request, 'GET /api/admin/vacaciones/seleccion/[id]', true, async () => {
    return NextResponse.json(await vista(idEntero((await params).id), 'rrhh'));
  });
}

/** Body `{ accion, ... }`: `validar` y `sugerir` no guardan; el resto devuelve la vista actualizada. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return conSesion(request, 'POST /api/admin/vacaciones/seleccion/[id]', true, async (s) => {
    return NextResponse.json(await postSeleccion(idEntero((await params).id), await leerJson(request), s.actor, 'rrhh'));
  });
}
