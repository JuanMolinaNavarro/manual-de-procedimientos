import { NextRequest, NextResponse } from 'next/server';
import { isAdmin, getSessionUsername, getScopeProyectos } from '@/lib/admin-auth';
import { createProyecto, getProyectos, type CreateProyectoData } from '@/lib/proyectos';

export async function GET() {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    return NextResponse.json(await getProyectos(await getScopeProyectos()));
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
    const scope = await getScopeProyectos();
    if (scope.tipo === 'ninguno') {
      return NextResponse.json(
        { error: 'Tu usuario no está vinculado a un área del organigrama' },
        { status: 403 }
      );
    }
    const body = (await request.json()) as CreateProyectoData;

    if (!body.nombre?.trim()) {
      return NextResponse.json({ error: 'El nombre del proyecto es requerido' }, { status: 400 });
    }
    if (!body.fecha_inicio) {
      return NextResponse.json({ error: 'La fecha de inicio es requerida' }, { status: 400 });
    }

    // Un admin con scope de área siempre crea en SU área (si no, no vería lo creado).
    const area =
      scope.tipo === 'area' ? scope.area : (typeof body.area === 'string' && body.area) || null;

    const proyecto = await createProyecto({
      nombre: body.nombre.trim(),
      descripcion: body.descripcion?.trim() || null,
      responsable: body.responsable?.trim() || null,
      responsable_id: body.responsable_id != null ? Number(body.responsable_id) || null : null,
      area,
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
