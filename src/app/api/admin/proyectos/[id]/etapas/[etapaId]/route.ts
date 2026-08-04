import { NextRequest, NextResponse } from 'next/server';
import { isAdmin, getScopeProyectos } from '@/lib/admin-auth';
import { deleteEtapa, getProyectoById, getProyectoVisible, moverEtapa, updateEtapa } from '@/lib/proyectos';
import { ESTADOS_ETAPA } from '@/lib/proyectos-datos';

type Params = { params: Promise<{ id: string; etapaId: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const { id, etapaId } = await params;
    if (!(await getProyectoVisible(Number(id), await getScopeProyectos()))) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    }
    const body = (await request.json()) as Record<string, unknown>;

    // `correr` mueve la etapa N días arrastrando a sus dependientes.
    if (body.correr != null) {
      await moverEtapa(Number(etapaId), Number(body.correr) || 0);
    }

    const data: Parameters<typeof updateEtapa>[1] = {};
    if (typeof body.nombre === 'string' && body.nombre.trim()) data.nombre = body.nombre.trim();
    if (typeof body.responsable === 'string') data.responsable = body.responsable.trim() || null;
    // null desvincula del organigrama y deja solo el texto libre.
    if ('responsable_id' in body) {
      data.responsable_id = body.responsable_id == null ? null : Number(body.responsable_id) || null;
    }
    if (body.duracion_dias != null) {
      data.duracion_dias = Math.max(1, Number(body.duracion_dias) || 1);
    }
    if (typeof body.estado === 'string' && ESTADOS_ETAPA.some((e) => e.id === body.estado)) {
      data.estado = body.estado;
    }
    if (body.avance != null) {
      data.avance = Math.max(0, Math.min(100, Math.round(Number(body.avance) || 0)));
    }
    if (typeof body.fecha_inicio === 'string' && body.fecha_inicio) {
      data.fecha_inicio = body.fecha_inicio;
    }

    if (Object.keys(data).length > 0) await updateEtapa(Number(etapaId), data);

    return NextResponse.json(await getProyectoById(Number(id)));
  } catch (error) {
    console.error('Error en PUT /api/admin/proyectos/[id]/etapas/[etapaId]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const { id, etapaId } = await params;
    if (!(await getProyectoVisible(Number(id), await getScopeProyectos()))) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    }
    await deleteEtapa(Number(etapaId));
    return NextResponse.json(await getProyectoById(Number(id)));
  } catch (error) {
    console.error('Error en DELETE /api/admin/proyectos/[id]/etapas/[etapaId]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
