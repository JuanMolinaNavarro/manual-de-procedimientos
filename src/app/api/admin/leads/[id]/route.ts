import { NextRequest, NextResponse } from 'next/server';
import { updateLead } from '@/lib/leads';
import { isAdmin } from '@/lib/admin-auth';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await isAdmin()) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 });
  }
  // Texto opcional: string (recortado, con tope) o null; cualquier otro tipo se ignora como null.
  const texto = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 500) || null : null);
  const update: { contactado?: boolean; resultado?: string | null; asignado?: string | null; nombre?: string | null; apellido?: string | null } = {};

  if (typeof body.contactado === 'boolean') update.contactado = body.contactado;
  if ('resultado' in body) update.resultado = texto(body.resultado);
  if ('asignado' in body) update.asignado = texto(body.asignado);
  if ('nombre' in body) update.nombre = texto(body.nombre);
  if ('apellido' in body) update.apellido = texto(body.apellido);

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
