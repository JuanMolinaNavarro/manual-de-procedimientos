import { NextRequest, NextResponse } from 'next/server';
import { canEditModule } from '@/lib/admin-auth';
import { updateArea, deleteArea, type UpdateOrgAreaData } from '@/lib/organigrama';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await canEditModule('organigrama'))) {
      return NextResponse.json({ error: 'Sin permiso de edición' }, { status: 403 });
    }
    const { id } = await params;
    const body = (await request.json()) as UpdateOrgAreaData;
    const area = await updateArea(Number(id), body);
    if (!area) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json(area);
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe un área con ese nombre' }, { status: 409 });
    }
    console.error('Error en PUT /api/admin/organigrama/areas/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await canEditModule('organigrama'))) {
      return NextResponse.json({ error: 'Sin permiso de edición' }, { status: 403 });
    }
    const { id } = await params;
    const ok = await deleteArea(Number(id));
    if (!ok) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error en DELETE /api/admin/organigrama/areas/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
