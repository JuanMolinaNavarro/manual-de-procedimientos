import { NextRequest, NextResponse } from 'next/server';
import { isAdmin, getSessionUsername } from '@/lib/admin-auth';
import {
  deleteProyecto,
  getProyectoById,
  updateProyecto,
  type UpdateProyectoData,
} from '@/lib/proyectos';
import { ESTADOS_PROYECTO, MONEDAS } from '@/lib/proyectos-datos';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const { id } = await params;
    const proyecto = await getProyectoById(Number(id));
    if (!proyecto) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json(proyecto);
  } catch (error) {
    console.error('Error en GET /api/admin/proyectos/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const { id } = await params;
    const proyectoId = Number(id);
    if (Number.isNaN(proyectoId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }
    const body = (await request.json()) as Record<string, unknown>;

    const data: UpdateProyectoData = { updated_by: await getSessionUsername() };
    if (typeof body.nombre === 'string' && body.nombre.trim()) data.nombre = body.nombre.trim();
    if (typeof body.descripcion === 'string') data.descripcion = body.descripcion.trim() || null;
    if (typeof body.responsable === 'string') data.responsable = body.responsable.trim() || null;
    // null desvincula del organigrama y deja solo el texto libre.
    if ('responsable_id' in body) {
      data.responsable_id = body.responsable_id == null ? null : Number(body.responsable_id) || null;
    }
    if (typeof body.notas === 'string') data.notas = body.notas;
    if (typeof body.fecha_inicio === 'string' && body.fecha_inicio) {
      data.fecha_inicio = body.fecha_inicio;
    }
    if (
      typeof body.estado === 'string' &&
      ESTADOS_PROYECTO.some((e) => e.id === body.estado)
    ) {
      data.estado = body.estado;
    }
    if (typeof body.moneda_ingreso === 'string' && MONEDAS.includes(body.moneda_ingreso as never)) {
      data.moneda_ingreso = body.moneda_ingreso;
    }
    if (body.ingreso_estimado != null) data.ingreso_estimado = Number(body.ingreso_estimado) || 0;
    if (body.otros_ingresos != null) data.otros_ingresos = Number(body.otros_ingresos) || 0;
    if (body.anio_ingreso != null) {
      const anio = Math.round(Number(body.anio_ingreso));
      if (!Number.isInteger(anio) || anio < 1900 || anio > 2200) {
        return NextResponse.json({ error: 'Año de ingreso inválido' }, { status: 400 });
      }
      data.anio_ingreso = anio;
    }

    const proyecto = await updateProyecto(proyectoId, data);
    if (!proyecto) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json(proyecto);
  } catch (error) {
    console.error('Error en PUT /api/admin/proyectos/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const { id } = await params;
    await deleteProyecto(Number(id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error en DELETE /api/admin/proyectos/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
