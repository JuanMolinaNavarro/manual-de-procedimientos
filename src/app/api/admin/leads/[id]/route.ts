import { NextRequest, NextResponse } from 'next/server';
import { updateLead } from '@/lib/leads';
import { cookies } from 'next/headers';

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get('site_session');
  if (!session?.value) return false;
  const parts = session.value.split('|');
  return parts.length > 1 && parts[1] === 'admin';
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await isAdmin()) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const body = await req.json() as Record<string, unknown>;
  const update: { contactado?: boolean; resultado?: string | null; asignado?: string | null } = {};

  if (typeof body.contactado === 'boolean') update.contactado = body.contactado;
  if ('resultado' in body) update.resultado = (body.resultado as string | null) ?? null;
  if ('asignado' in body) update.asignado = (body.asignado as string | null) || null;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Sin campos para actualizar' }, { status: 400 });
  }

  try {
    const lead = await updateLead(id, update);
    return NextResponse.json(lead);
  } catch (error) {
    console.error(`Error en PATCH /api/admin/leads/${id}:`, error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
