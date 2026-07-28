import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { addEtapa, getProyectoById } from '@/lib/proyectos';

/** Agrega una etapa manual al final del cronograma. */
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
    await addEtapa(proyectoId);
    return NextResponse.json(await getProyectoById(proyectoId), { status: 201 });
  } catch (error) {
    console.error('Error en POST /api/admin/proyectos/[id]/etapas:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
