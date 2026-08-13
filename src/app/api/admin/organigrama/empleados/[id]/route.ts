import { NextRequest, NextResponse } from 'next/server';
import { unlinkSync } from 'fs';
import { join } from 'path';
import { isAdmin, getSessionUsername, canEditModule } from '@/lib/admin-auth';
import {
  getEmpleadoById,
  getDocumentosDeEmpleado,
  updateEmpleado,
  deleteEmpleado,
  validateNoCycle,
  type UpdateOrgEmpleadoData,
} from '@/lib/organigrama';

const DOCS_DIR = join(process.cwd(), 'uploads', 'organigrama', 'documentos');

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const { id } = await params;
  const empleado = await getEmpleadoById(Number(id));
  if (!empleado) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json(empleado);
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

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await canEditModule('organigrama'))) {
      return NextResponse.json({ error: 'Sin permiso de edición' }, { status: 403 });
    }
    const { id } = await params;
    // Los OrgDocumento cascadean en DB al borrar el empleado; los archivos
    // físicos hay que desvincularlos a mano (best-effort), antes de perder las filas.
    const documentos = await getDocumentosDeEmpleado(Number(id));
    const ok = await deleteEmpleado(Number(id));
    if (!ok) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    for (const doc of documentos) {
      try {
        unlinkSync(join(DOCS_DIR, doc.nombre_archivo));
      } catch {}
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error en DELETE /api/admin/organigrama/empleados/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
