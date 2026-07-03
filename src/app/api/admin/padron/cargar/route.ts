import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { cargarPadronDesdeBuffer, contarPadronPorEmpresa } from '@/lib/padron';
import { isEmpresa } from '@/lib/empresas';

export const dynamic = 'force-dynamic';
export const maxDuration = 600;

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get('site_session')?.value?.split('|')[1] === 'admin';
}

/** GET: cantidad de abonados cargados por empresa. */
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  try {
    return NextResponse.json({ counts: await contarPadronPorEmpresa() });
  } catch (error) {
    console.error('Error en GET /api/admin/padron/cargar:', error);
    return NextResponse.json({ error: 'Error al consultar el padrón.' }, { status: 500 });
  }
}

/** POST: sube un Excel y reemplaza el padrón de la empresa indicada. */
export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  try {
    const formData = await request.formData();
    const empresa = String(formData.get('empresa') ?? '');
    const file = formData.get('file') as File | null;

    if (!isEmpresa(empresa)) {
      return NextResponse.json({ error: 'Empresa inválida.' }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ error: 'No se recibió el archivo.' }, { status: 400 });
    }
    if (!/\.xlsx$/i.test(file.name)) {
      return NextResponse.json({ error: 'El archivo debe ser un .xlsx' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { total } = await cargarPadronDesdeBuffer(empresa, buffer);
    return NextResponse.json({ total, empresa });
  } catch (error) {
    console.error('Error en POST /api/admin/padron/cargar:', error);
    return NextResponse.json(
      { error: 'Error al procesar el Excel del padrón.' },
      { status: 500 },
    );
  }
}
