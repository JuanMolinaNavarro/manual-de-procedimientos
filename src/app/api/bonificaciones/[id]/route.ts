/**
 * API Route: /api/bonificaciones/[id]
 *
 * PUT - Actualiza una bonificación existente
 * DELETE - Soft delete (desactiva la bonificación) o borrado real
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  deleteBonificacion,
  getBonificacionById,
  softDeleteBonificacion,
  updateBonificacion,
  type UpdateBonificacionData,
} from '@/lib/bonificaciones';
import { cookies } from 'next/headers';
import { EMPRESAS, type Empresa } from '@/lib/empresas';

// TypeScript no permite includes(string) sobre un union literal.
const EMPRESAS_STRINGS: readonly string[] = EMPRESAS;

function isEmpresa(value: string): value is Empresa {
  return EMPRESAS_STRINGS.includes(value);
}

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session');
  return session?.value === process.env.ADMIN_PASSWORD;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const bonificacionId = Number(id);

    if (Number.isNaN(bonificacionId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const existing = getBonificacionById(bonificacionId);
    if (!existing) {
      return NextResponse.json(
        { error: 'Bonificación no encontrada' },
        { status: 404 }
      );
    }

    const body = await request.json() as UpdateBonificacionData;
    const empresaRaw = body.empresa?.trim();

    if (empresaRaw && !isEmpresa(empresaRaw)) {
      return NextResponse.json(
        { error: 'La empresa indicada no es válida' },
        { status: 400 }
      );
    }

    const empresa: Empresa | undefined =
      empresaRaw && isEmpresa(empresaRaw) ? empresaRaw : undefined;

    const updated = updateBonificacion(bonificacionId, {
      ...body,
      empresa,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error en PUT /api/bonificaciones/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const bonificacionId = Number(id);

    if (Number.isNaN(bonificacionId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const hardDelete = request.nextUrl.searchParams.get('hard') === 'true';
    const success = hardDelete
      ? deleteBonificacion(bonificacionId)
      : softDeleteBonificacion(bonificacionId);

    if (!success) {
      return NextResponse.json(
        { error: 'Bonificación no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: hardDelete
        ? 'Bonificación eliminada correctamente'
        : 'Bonificación desactivada correctamente',
    });
  } catch (error) {
    console.error('Error en DELETE /api/bonificaciones/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

