import { NextRequest, NextResponse } from 'next/server';
import { isAdmin, getSessionUsername } from '@/lib/admin-auth';
import { createProyecto, getProyectos, type CreateProyectoData } from '@/lib/proyectos';

export async function GET() {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    return NextResponse.json(await getProyectos());
  } catch (error) {
    console.error('Error en GET /api/admin/proyectos:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const body = (await request.json()) as CreateProyectoData;

    if (!body.nombre?.trim()) {
      return NextResponse.json({ error: 'El nombre del proyecto es requerido' }, { status: 400 });
    }
    if (!body.fecha_inicio) {
      return NextResponse.json({ error: 'La fecha de inicio es requerida' }, { status: 400 });
    }

    const proyecto = await createProyecto({
      nombre: body.nombre.trim(),
      descripcion: body.descripcion?.trim() || null,
      responsable: body.responsable?.trim() || null,
      fecha_inicio: body.fecha_inicio,
      plantilla: body.plantilla,
      created_by: await getSessionUsername(),
    });
    return NextResponse.json(proyecto, { status: 201 });
  } catch (error) {
    console.error('Error en POST /api/admin/proyectos:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
