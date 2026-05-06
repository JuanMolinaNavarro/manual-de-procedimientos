import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getPlanConfig, upsertPlanConfig, type PlanConfigData } from '@/lib/planes';
import { isEmpresa } from '@/lib/empresas';

function getRoleFromSession(value: string | undefined) {
  if (!value) return null;
  const parts = value.split('|');
  return parts.length > 1 ? parts[1] : null;
}

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get('site_session');
  return getRoleFromSession(session?.value) === 'admin';
}

export async function GET(request: NextRequest) {
  if (!await isAdmin()) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const empresaRaw = request.nextUrl.searchParams.get('empresa')?.trim();
  if (!empresaRaw || !isEmpresa(empresaRaw)) {
    return NextResponse.json(
      { error: 'El parámetro "empresa" es requerido y debe ser válido' },
      { status: 400 }
    );
  }

  try {
    const data = await getPlanConfig(empresaRaw);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error en GET /api/admin/planes:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  if (!await isAdmin()) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const empresaRaw = request.nextUrl.searchParams.get('empresa')?.trim();
  if (!empresaRaw || !isEmpresa(empresaRaw)) {
    return NextResponse.json(
      { error: 'El parámetro "empresa" es requerido y debe ser válido' },
      { status: 400 }
    );
  }

  try {
    const body = (await request.json()) as PlanConfigData;

    if (!Array.isArray(body.plans) || typeof body.tvAddonPrice !== 'number') {
      return NextResponse.json(
        { error: 'El cuerpo debe incluir "plans" (array) y "tvAddonPrice" (número)' },
        { status: 400 }
      );
    }

    const updated = await upsertPlanConfig(empresaRaw, body);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error en PUT /api/admin/planes:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
