import { NextRequest, NextResponse } from 'next/server';
import { isAdmin, canEditModule } from '@/lib/admin-auth';
import { getAllOrganigramas, createOrganigrama } from '@/lib/organigrama';

// Lista de organigramas (empresas/ubicaciones).
export async function GET() {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    return NextResponse.json(await getAllOrganigramas());
  } catch (error) {
    console.error('Error en GET /api/admin/organigrama/organigramas:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await canEditModule('organigrama'))) {
      return NextResponse.json({ error: 'Sin permiso de edición' }, { status: 403 });
    }
    const body = (await request.json()) as { nombre?: string; direccion?: string };
    if (!body.nombre?.trim()) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    }
    const org = await createOrganigrama(body.nombre.trim(), body.direccion?.trim() || null);
    return NextResponse.json(org, { status: 201 });
  } catch (error) {
    console.error('Error en POST /api/admin/organigrama/organigramas:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
