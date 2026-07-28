import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { deleteCosto, getProyectoById, updateCosto } from '@/lib/proyectos';
import { MONEDAS } from '@/lib/proyectos-datos';

type Params = { params: Promise<{ id: string; costoId: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const { id, costoId } = await params;
    const body = (await request.json()) as Record<string, unknown>;

    const data: Parameters<typeof updateCosto>[1] = {};
    if (typeof body.categoria === 'string') data.categoria = body.categoria.trim() || 'General';
    if (typeof body.concepto === 'string') data.concepto = body.concepto;
    if (typeof body.unidad === 'string') data.unidad = body.unidad;
    if (body.cantidad != null) data.cantidad = Number(body.cantidad) || 0;
    if (body.costo_unitario != null) data.costo_unitario = Number(body.costo_unitario) || 0;
    if (typeof body.moneda === 'string' && MONEDAS.includes(body.moneda as never)) {
      data.moneda = body.moneda;
    }
    // etapa_id === null desimputa la línea; undefined la deja como está.
    if ('etapa_id' in body) {
      data.etapa_id = body.etapa_id == null ? null : Number(body.etapa_id) || null;
    }

    await updateCosto(Number(costoId), data);
    return NextResponse.json(await getProyectoById(Number(id)));
  } catch (error) {
    console.error('Error en PUT /api/admin/proyectos/[id]/costos/[costoId]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const { id, costoId } = await params;
    await deleteCosto(Number(costoId));
    return NextResponse.json(await getProyectoById(Number(id)));
  } catch (error) {
    console.error('Error en DELETE /api/admin/proyectos/[id]/costos/[costoId]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
