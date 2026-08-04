import { NextRequest, NextResponse } from 'next/server';
import { isAdmin, getScopeProyectos } from '@/lib/admin-auth';
import { addCosto, getProyectoById, getProyectoVisible } from '@/lib/proyectos';

/** Agrega una línea de costo en blanco y devuelve el proyecto actualizado. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const { id } = await params;
    const proyectoId = Number(id);
    if (Number.isNaN(proyectoId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }
    if (!(await getProyectoVisible(proyectoId, await getScopeProyectos()))) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    }
    await addCosto(proyectoId);
    return NextResponse.json(await getProyectoById(proyectoId), { status: 201 });
  } catch (error) {
    console.error('Error en POST /api/admin/proyectos/[id]/costos:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
