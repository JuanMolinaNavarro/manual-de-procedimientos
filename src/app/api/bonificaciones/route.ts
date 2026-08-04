/**
 * API Route: /api/bonificaciones
 *
 * GET - Obtiene bonificaciones activas filtradas por empresa
 * POST - Crea una nueva bonificación (requiere autenticación admin)
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminRole } from '@/lib/roles';
import {
  createBonificacion,
  getAllBonificaciones,
  getBonificacionesActivas,
  type CreateBonificacionData,
} from '@/lib/bonificaciones';
import { EMPRESAS, type Empresa } from '@/lib/empresas';
import { cookies } from 'next/headers';

// TypeScript no permite includes(string) sobre un union literal.
const EMPRESAS_STRINGS: readonly string[] = EMPRESAS;

function isEmpresa(value: string): value is Empresa {
  return EMPRESAS_STRINGS.includes(value);
}


function getRoleFromSession(value: string | undefined) {
  if (!value) return null;
  const parts = value.split('|');
  return parts.length > 1 ? parts[1] : null;
}

async function isSiteAuthed(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get('site_session');
  return Boolean(session?.value);
}

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get('site_session');
  const role = getRoleFromSession(session?.value);
  return isAdminRole(role);
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

    if (!await isSiteAuthed()) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (empresaRaw && !isEmpresa(empresaRaw)) {
      return NextResponse.json(
        { error: 'La empresa indicada no es válida' },
        { status: 400 }
      );
    }

    const empresa: Empresa | null =
      empresaRaw && isEmpresa(empresaRaw) ? empresaRaw : null;

    const bonificaciones = await getBonificacionesActivas(empresa);
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
