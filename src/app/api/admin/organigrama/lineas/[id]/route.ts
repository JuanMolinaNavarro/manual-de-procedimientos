import { NextRequest, NextResponse } from 'next/server';
import { canEditModule } from '@/lib/admin-auth';
import { updateLinea, deleteLinea, type UpdateOrgLineaData } from '@/lib/organigrama';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await canEditModule('organigrama'))) {
      return NextResponse.json({ error: 'Sin permiso de edición' }, { status: 403 });
    }
    const { id } = await params;
    const body = (await request.json()) as UpdateOrgLineaData;
    const linea = await updateLinea(Number(id), body);
    if (!linea) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json(linea);
  } catch (error) {
    console.error('Error en PUT /api/admin/organigrama/lineas/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await canEditModule('organigrama'))) {
      return NextResponse.json({ error: 'Sin permiso de edición' }, { status: 403 });
    }
    const { id } = await params;
    const ok = await deleteLinea(Number(id));
    if (!ok) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error en DELETE /api/admin/organigrama/lineas/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
