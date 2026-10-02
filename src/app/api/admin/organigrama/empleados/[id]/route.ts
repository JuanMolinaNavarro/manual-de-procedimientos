import { NextRequest, NextResponse } from 'next/server';
import { isAdmin, getSessionUsername, canEditModule } from '@/lib/admin-auth';
import {
  getEmpleadoById,
  updateEmpleado,
  ocultarEmpleado,
  restaurarEmpleado,
  transferirEmpleado,
  ocultarConvenio,
  validateNoCycle,
  type UpdateOrgEmpleadoData,
} from '@/lib/organigrama';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  try {
    const empleado = await getEmpleadoById(n);
    if (!empleado) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json(ocultarConvenio(empleado, await canEditModule('organigrama')));
  } catch (error) {
    console.error('Error en GET /api/admin/organigrama/empleados/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await canEditModule('organigrama'))) {
      return NextResponse.json({ error: 'Sin permiso de edición' }, { status: 403 });
    }
    const { id } = await params;
    const empleadoId = Number(id);
    const body = (await request.json()) as UpdateOrgEmpleadoData;

    // Validación anti-ciclos al (re)asignar jefe.
    if (body.manager_id !== undefined && body.manager_id !== null) {
      const ok = await validateNoCycle(empleadoId, body.manager_id);
      if (!ok) {
        return NextResponse.json(
          { error: 'Asignación inválida: crearía un ciclo en la jerarquía de reporte.' },
          { status: 400 },
        );
      }
    }

    const username = await getSessionUsername();
    const empleado = await updateEmpleado(empleadoId, { ...body, updated_by: username });
    if (!empleado) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json(empleado);
  } catch (error) {
    console.error('Error en PUT /api/admin/organigrama/empleados/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// DELETE = quitar del organigrama. No borra nada: la ficha queda oculta e inactiva (`ocultarEmpleado`).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await canEditModule('organigrama'))) {
      return NextResponse.json({ error: 'Sin permiso de edición' }, { status: 403 });
    }
    const { id } = await params;
    const ok = await ocultarEmpleado(Number(id), await getSessionUsername());
    if (!ok) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error en DELETE /api/admin/organigrama/empleados/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// PATCH { oculto: false } — restaurar una ficha oculta al lienzo (vuelve activa).
// PATCH { organigrama_id, area } — transferirla a otro organigrama (`transferirEmpleado`).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await canEditModule('organigrama'))) {
      return NextResponse.json({ error: 'Sin permiso de edición' }, { status: 403 });
    }
    const { id } = await params;
    const body = (await request.json().catch(() => null)) as
      | { oculto?: unknown; organigrama_id?: unknown; area?: unknown }
      | null;
    if (body?.organigrama_id !== undefined) {
      const orgId = Number(body.organigrama_id);
      const area = typeof body.area === 'string' ? body.area : '';
      if (!Number.isInteger(orgId) || orgId <= 0) {
        return NextResponse.json({ error: 'Organigrama inválido' }, { status: 400 });
      }
      const r = await transferirEmpleado(Number(id), orgId, area, await getSessionUsername());
      if (r === 'no_existe') return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
      if (r === 'destino_invalido') {
        return NextResponse.json({ error: 'El organigrama destino no existe o es el actual' }, { status: 400 });
      }
      if (r === 'area_invalida') {
        return NextResponse.json({ error: 'El área no pertenece al organigrama destino' }, { status: 400 });
      }
      return NextResponse.json({ ok: true });
    }
    if (body?.oculto !== false) {
      return NextResponse.json({ error: 'Solo se admite { "oculto": false } o { "organigrama_id", "area" }' }, { status: 400 });
    }
    const ok = await restaurarEmpleado(Number(id), await getSessionUsername());
    if (!ok) return NextResponse.json({ error: 'No encontrado o no estaba oculto' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error en PATCH /api/admin/organigrama/empleados/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
