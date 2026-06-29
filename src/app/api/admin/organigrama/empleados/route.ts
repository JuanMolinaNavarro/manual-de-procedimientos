import { NextRequest, NextResponse } from 'next/server';
import { isAdmin, getSessionUsername, canEditModule } from '@/lib/admin-auth';
import {
  getAllEmpleados,
  createEmpleado,
  type CreateOrgEmpleadoData,
} from '@/lib/organigrama';

export async function GET() {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    return NextResponse.json(await getAllEmpleados());
  } catch (error) {
    console.error('Error en GET /api/admin/organigrama/empleados:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await canEditModule('organigrama'))) {
      return NextResponse.json({ error: 'Sin permiso de edición' }, { status: 403 });
    }
    const username = await getSessionUsername();
    const body = (await request.json()) as CreateOrgEmpleadoData;
    if (!body.nombre?.trim()) {
      return NextResponse.json({ error: 'El campo "nombre" es requerido' }, { status: 400 });
    }
    // En creación el id aún no existe, así que el ciclo solo puede darse si el manager
    // es inválido; igual lo validamos defensivamente cuando haya manager_id.
    const empleado = await createEmpleado({
      ...body,
      nombre: body.nombre.trim(),
      rol: body.rol?.trim() || 'Sin rol',
      area: body.area ?? '',
      created_by: username,
      updated_by: username,
    });
    return NextResponse.json(empleado, { status: 201 });
  } catch (error) {
    console.error('Error en POST /api/admin/organigrama/empleados:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
