import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAllSaltosImporte, createSaltoImporte, type CreateSaltoImporteData } from '@/lib/senales-ip';
import { isAdminRole } from '@/lib/roles';

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get('site_session');
  const role = session?.value?.split('|')[1];
  return isAdminRole(role);
}

async function getUsername(): Promise<string | null> {
  const cookieStore = await cookies();
  const val = cookieStore.get('site_session')?.value;
  return val ? val.split('|')[0] : null;
}

export async function GET() {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const saltos = await getAllSaltosImporte();
    return NextResponse.json(saltos);
  } catch (error) {
    console.error('Error en GET /api/admin/senales-ip/saltos:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const username = await getUsername();
    const body = await request.json() as CreateSaltoImporteData;
    if (!body.descripcion?.trim() || !body.fecha_efectiva?.trim()) {
      return NextResponse.json(
        { error: 'Los campos "descripcion" y "fecha_efectiva" son requeridos' },
        { status: 400 },
      );
    }
    const salto = await createSaltoImporte({ ...body, created_by: username, updated_by: username });
    return NextResponse.json(salto, { status: 201 });
  } catch (error) {
    console.error('Error en POST /api/admin/senales-ip/saltos:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
