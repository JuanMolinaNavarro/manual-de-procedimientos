/**
 * API Route: /api/admin/usuarios
 *
 * GET - Lista usuarios (admin)
 * POST - Crea usuario (admin)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';


function getRoleFromSession(value: string | undefined) {
  if (!value) return null;
  const parts = value.split('|');
  return parts.length > 1 ? parts[1] : null;
}

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get('site_session');
  const role = getRoleFromSession(session?.value);
  return role === 'admin';
}

export async function GET() {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const usuarios = await prisma.usuario.findMany({
      orderBy: { id: 'desc' },
    });

    return NextResponse.json(usuarios);
  } catch (error) {
    console.error('Error en GET /api/admin/usuarios:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = (await request.json()) as {
      usuario?: string;
      password?: string;
      rol?: string;
      nombre?: string;
      apellido?: string;
    };
    const usuario = body.usuario?.trim();
    const password = body.password?.trim();
    const rol = body.rol?.trim() || 'agente';
    const nombre = body.nombre?.trim();
    const apellido = body.apellido?.trim();

    if (!usuario || !password) {
      return NextResponse.json(
        { error: 'Usuario y contrasena son requeridos' },
        { status: 400 }
      );
    }

    if (rol !== 'admin' && rol !== 'agente') {
      return NextResponse.json(
        { error: 'Rol invalido' },
        { status: 400 }
      );
    }

    const created = await prisma.usuario.create({
      data: {
        usuario,
        password,
        rol,
        nombre: nombre || null,
        apellido: apellido || null,
        isActive: true,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json({ error: 'El usuario ya existe' }, { status: 400 });
    }
    console.error('Error en POST /api/admin/usuarios:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
