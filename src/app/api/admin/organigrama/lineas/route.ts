import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { getAllLineas, createLinea, type CreateOrgLineaData } from '@/lib/organigrama';

export async function GET() {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    return NextResponse.json(await getAllLineas());
  } catch (error) {
    console.error('Error en GET /api/admin/organigrama/lineas:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const body = (await request.json()) as CreateOrgLineaData;
    if (typeof body.from_id !== 'number' || typeof body.to_id !== 'number') {
      return NextResponse.json({ error: 'from_id y to_id son requeridos' }, { status: 400 });
    }
    const linea = await createLinea(body);
    return NextResponse.json(linea, { status: 201 });
  } catch (error) {
    console.error('Error en POST /api/admin/organigrama/lineas:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
