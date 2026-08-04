/**
 * API Route: /api/me
 *
 * Devuelve el usuario logueado (sin contraseña).
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

function getUsuarioFromSession(value: string | undefined) {
  if (!value) return null;
  return value.split('|')[0] || null;
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('site_session')?.value;
    const usuario = getUsuarioFromSession(session);

    if (!usuario) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const record = await prisma.usuario.findUnique({
      where: { usuario },
      select: {
        usuario: true,
        nombre: true,
        apellido: true,
        rol: true,
        empleado: { select: { id: true, nombre: true, area: true } },
      },
    });

    if (!record) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    return NextResponse.json(record);
  } catch (error) {
    console.error('Error en GET /api/me:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
