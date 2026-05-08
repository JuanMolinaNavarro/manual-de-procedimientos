import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAllContratosComprador, createContratoComprador, type CreateContratoCompradorData } from '@/lib/senales-ip';

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get('site_session');
  const role = session?.value?.split('|')[1];
  return role === 'admin';
}

function getUsername(): Promise<string | null> {
  return cookies().then((store) => {
    const val = store.get('site_session')?.value;
    return val ? val.split('|')[0] : null;
  });
}

export async function GET() {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const contratos = await getAllContratosComprador();
    return NextResponse.json(contratos);
  } catch (error) {
    console.error('Error en GET /api/admin/senales-ip/compradores:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const username = await getUsername();
    const body = await request.json() as CreateContratoCompradorData;
    if (!body.nombre_empresa?.trim()) {
      return NextResponse.json({ error: 'El campo "nombre_empresa" es requerido' }, { status: 400 });
    }
    const contrato = await createContratoComprador({
      ...body,
      nombre_empresa: body.nombre_empresa.trim(),
      created_by: username,
      updated_by: username,
    });
    return NextResponse.json(contrato, { status: 201 });
  } catch (error) {
    console.error('Error en POST /api/admin/senales-ip/compradores:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
