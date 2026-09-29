import { NextRequest, NextResponse } from 'next/server';
import { buscarPadron } from '@/lib/padron';
import { isEmpresa } from '@/lib/empresas';
import { isAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

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
