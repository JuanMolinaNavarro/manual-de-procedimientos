import { NextRequest, NextResponse } from 'next/server';
import { canEditModule } from '@/lib/admin-auth';
import { updateOrganigrama } from '@/lib/organigrama';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await canEditModule('organigrama'))) {
      return NextResponse.json({ error: 'Sin permiso de edición' }, { status: 403 });
    }
    const { id } = await params;
    const body = (await request.json()) as { nombre?: string; direccion?: string | null };
    if (body.nombre !== undefined && !body.nombre.trim()) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    }
    const org = await updateOrganigrama(Number(id), {
      nombre: body.nombre?.trim(),
      direccion: body.direccion === undefined ? undefined : body.direccion?.trim() || null,
    });
    if (!org) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json(org);
  } catch (error) {
    console.error('Error en PUT /api/admin/organigrama/organigramas/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
