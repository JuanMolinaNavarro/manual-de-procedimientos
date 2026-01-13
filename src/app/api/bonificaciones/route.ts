/**
 * API Route: /api/bonificaciones
 *
 * GET - Obtiene bonificaciones activas filtradas por empresa
 * POST - Crea una nueva bonificación (requiere autenticación admin)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createBonificacion,
  getAllBonificaciones,
  getBonificacionesActivas,
  type CreateBonificacionData,
} from '@/lib/bonificaciones';
import { EMPRESAS } from '@/lib/empresas';
import { cookies } from 'next/headers';

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session');
  return session?.value === process.env.ADMIN_PASSWORD;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const empresa = searchParams.get('empresa');
    const all = searchParams.get('all');

    if (all === 'true') {
      if (!await isAdmin()) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
      }
      const bonificaciones = getAllBonificaciones();
      return NextResponse.json(bonificaciones);
    }

    if (empresa && !EMPRESAS.includes(empresa)) {
      return NextResponse.json(
        { error: 'La empresa indicada no es válida' },
        { status: 400 }
      );
    }

    const bonificaciones = getBonificacionesActivas(empresa);
    return NextResponse.json(bonificaciones);
  } catch (error) {
    console.error('Error en GET /api/bonificaciones:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json() as CreateBonificacionData;

    if (!body.empresa || !body.titulo) {
      return NextResponse.json(
        { error: 'Los campos "empresa" y "titulo" son requeridos' },
        { status: 400 }
      );
    }

    if (!EMPRESAS.includes(body.empresa)) {
      return NextResponse.json(
        { error: 'La empresa indicada no es válida' },
        { status: 400 }
      );
    }

    const bonificacion = createBonificacion(body);
    return NextResponse.json(bonificacion, { status: 201 });
  } catch (error) {
    console.error('Error en POST /api/bonificaciones:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
