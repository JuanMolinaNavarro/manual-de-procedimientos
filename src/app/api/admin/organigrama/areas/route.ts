import { NextRequest, NextResponse } from 'next/server';
import { isAdmin, canEditModule } from '@/lib/admin-auth';
import { getAllAreas, createArea, type CreateOrgAreaData } from '@/lib/organigrama';

export async function GET() {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    return NextResponse.json(await getAllAreas());
  } catch (error) {
    console.error('Error en GET /api/admin/organigrama/areas:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await canEditModule('organigrama'))) {
      return NextResponse.json({ error: 'Sin permiso de edición' }, { status: 403 });
    }
    const body = (await request.json()) as CreateOrgAreaData;
    if (!body.nombre?.trim()) {
      return NextResponse.json({ error: 'El campo "nombre" es requerido' }, { status: 400 });
    }
    const area = await createArea({ ...body, nombre: body.nombre.trim() });
    return NextResponse.json(area, { status: 201 });
  } catch (error: unknown) {
    // nombre único: Prisma lanza P2002 si el área ya existe.
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe un área con ese nombre' }, { status: 409 });
    }
    console.error('Error en POST /api/admin/organigrama/areas:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
