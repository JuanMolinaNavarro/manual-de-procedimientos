import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { getProyectosDeEmpleado } from '@/lib/proyectos';

/** Proyectos en los que participa un empleado: para la pestaña de su ficha. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const { id } = await params;
    const empleadoId = Number(id);
    if (Number.isNaN(empleadoId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }
    return NextResponse.json(await getProyectosDeEmpleado(empleadoId));
  } catch (error) {
    console.error('Error en GET /api/admin/organigrama/empleados/[id]/proyectos:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
