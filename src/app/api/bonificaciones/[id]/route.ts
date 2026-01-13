/**
 * API Route: /api/bonificaciones/[id]
 *
 * PUT - Actualiza una bonificación existente
 * DELETE - Soft delete (desactiva la bonificación)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getBonificacionById,
  softDeleteBonificacion,
  updateBonificacion,
  type UpdateBonificacionData,
} from '@/lib/bonificaciones';
import { cookies } from 'next/headers';

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

    if (body.tipo && body.tipo !== 'A' && body.tipo !== 'B') {
      return NextResponse.json(
        { error: 'El tipo debe ser "A" o "B"' },
        { status: 400 }
      );
    }

    const updated = updateBonificacion(bonificacionId, body);
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

    const success = softDeleteBonificacion(bonificacionId);

    if (!success) {
      return NextResponse.json(
        { error: 'Bonificación no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Bonificación desactivada correctamente',
    });
  } catch (error) {
    console.error('Error en DELETE /api/bonificaciones/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
