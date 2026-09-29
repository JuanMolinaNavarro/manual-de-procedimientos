/**
 * API Route: /api/bonificaciones
 *
 * GET - Bonificaciones activas (opcionalmente por empresa). Público y con CORS: lo lee el manual
 *       de retención, que es un proyecto aparte y sin login. `?all=true` (todas, también
 *       inactivas) es solo del panel admin.
 * POST - Crea una nueva bonificación (requiere autenticación admin)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createBonificacion,
  getAllBonificaciones,
  getBonificacionesActivas,
  type CreateBonificacionData,
} from '@/lib/bonificaciones';
import { EMPRESAS, type Empresa } from '@/lib/empresas';
import { isAdmin } from '@/lib/admin-auth';

// TypeScript no permite includes(string) sobre un union literal.
const EMPRESAS_STRINGS: readonly string[] = EMPRESAS;

function isEmpresa(value: string): value is Empresa {
  return EMPRESAS_STRINGS.includes(value);
}

// Solo para la lectura pública de activas (el manual de retención corre en otro origen).
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}


export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const empresaRaw = searchParams.get('empresa')?.trim();
    const all = searchParams.get('all');

    if (all === 'true') {
      if (!await isAdmin()) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
      }
      const bonificaciones = await getAllBonificaciones();
      return NextResponse.json(bonificaciones);
    }

    if (empresaRaw && !isEmpresa(empresaRaw)) {
      return NextResponse.json(
        { error: 'La empresa indicada no es válida' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const empresa: Empresa | null =
      empresaRaw && isEmpresa(empresaRaw) ? empresaRaw : null;

    const bonificaciones = await getBonificacionesActivas(empresa);
    return NextResponse.json(bonificaciones, { headers: CORS_HEADERS });
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
    const empresaRaw = body.empresa?.trim();

    if (!empresaRaw || !body.titulo) {
      return NextResponse.json(
        { error: 'Los campos "empresa" y "titulo" son requeridos' },
        { status: 400 }
      );
    }

    if (!isEmpresa(empresaRaw)) {
      return NextResponse.json(
        { error: 'La empresa indicada no es válida' },
        { status: 400 }
      );
    }

    const bonificacion = await createBonificacion({
      ...body,
      empresa: empresaRaw,
    });

    return NextResponse.json(bonificacion, { status: 201 });
  } catch (error) {
    console.error('Error en POST /api/bonificaciones:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
