import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { marcarSaltoNotificado, updateSaltoImporte, deleteSaltoImporte } from '@/lib/senales-ip';
import { isAdminRole } from '@/lib/roles';

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get('site_session');
  const role = session?.value?.split('|')[1];
  return isAdminRole(role);
}

async function getUsername(): Promise<string | null> {
  const cookieStore = await cookies();
  const val = cookieStore.get('site_session')?.value;
  return val ? val.split('|')[0] : null;
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const { id } = await params;
    const saltoId = Number(id);
    if (Number.isNaN(saltoId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }
    const username = await getUsername();
    const body = await request.json() as Record<string, unknown>;
    if (body.notificado === true) {
      const updated = await marcarSaltoNotificado(saltoId);
      if (!updated) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
      return NextResponse.json(updated);
    }
    const updated = await updateSaltoImporte(saltoId, { ...body as Parameters<typeof updateSaltoImporte>[1], updated_by: username });
    if (!updated) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error en PUT /api/admin/senales-ip/saltos/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const { id } = await params;
    const saltoId = Number(id);
    if (Number.isNaN(saltoId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }
    const ok = await deleteSaltoImporte(saltoId);
    if (!ok) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json({ message: 'Salto eliminado correctamente' });
  } catch (error) {
    console.error('Error en DELETE /api/admin/senales-ip/saltos/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
