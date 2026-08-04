import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { buscarPadron } from '@/lib/padron';
import { isEmpresa } from '@/lib/empresas';
import { isAdminRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  return isAdminRole(cookieStore.get('site_session')?.value?.split('|')[1]);
}

/** GET /api/admin/padron/buscar?empresa=&dni=&nombre=&domicilio=&page= */
export async function GET(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const empresa = sp.get('empresa') ?? '';
  const dni = sp.get('dni') ?? '';
  const nombre = sp.get('nombre') ?? '';
  const domicilio = sp.get('domicilio') ?? '';
  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1);

  if (!isEmpresa(empresa)) {
    return NextResponse.json({ error: 'Seleccioná una empresa.' }, { status: 400 });
  }
  if (![dni, nombre, domicilio].some((v) => v.trim())) {
    return NextResponse.json(
      { error: 'Ingresá al menos un criterio (DNI, nombre o domicilio).' },
      { status: 400 },
    );
  }

  try {
    const result = await buscarPadron({ empresa, dni, nombre, domicilio, page });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error en GET /api/admin/padron/buscar:', error);
    return NextResponse.json({ error: 'Error al buscar en el padrón.' }, { status: 500 });
  }
}
