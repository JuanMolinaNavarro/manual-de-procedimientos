import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { getRecibosDeEmpleado } from '@/lib/nomina';

/** Recibos cerrados de una ficha del organigrama (pestaña "Recibos"). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const { id } = await params;
    const empleadoId = Number(id);
    if (!Number.isInteger(empleadoId) || empleadoId <= 0) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }
    return NextResponse.json(await getRecibosDeEmpleado(empleadoId));
  } catch (error) {
    console.error('Error en GET /api/admin/organigrama/empleados/[id]/recibos:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
