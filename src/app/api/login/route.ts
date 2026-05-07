/**
 * API Route: /api/login
 *
 * POST - Valida usuario/contrasena contra la DB (sin encriptacion).
 * DELETE - Cierra sesion y elimina la cookie.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const COOKIE_NAME = 'site_session';

async function ensureSeedUser() {
  const count = await prisma.usuario.count();
  const envUser = process.env.SITE_USER;
  const envPass = process.env.SITE_PASSWORD;

  if (count === 0 && envUser && envPass) {
    await prisma.usuario.create({
      data: {
        usuario: envUser,
        password: envPass,
        rol: 'admin',
      },
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      usuario?: string;
      password?: string;
    };

    const usuario = body.usuario?.trim();
    const password = body.password?.trim();

    if (!usuario || !password) {
      return NextResponse.json(
        { error: 'Usuario y contrasena son requeridos' },
        { status: 400 }
      );
    }

    await ensureSeedUser();

    const record = await prisma.usuario.findUnique({
      where: { usuario },
    });

    if (!record || record.password !== password) {
      return NextResponse.json({ error: 'Credenciales invalidas' }, { status: 401 });
    }

    if (record.isActive !== true) {
      return NextResponse.json({ error: 'Usuario inactivo' }, { status: 403 });
    }

    const response = NextResponse.json({ ok: true, rol: record.rol });
    const sessionValue = `${record.usuario}|${record.rol}`;
    const protocol = request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol;
    response.cookies.set(COOKIE_NAME, sessionValue, {
      httpOnly: true,
      sameSite: 'lax',
      secure: protocol === 'https:',
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Error en POST /api/login:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(COOKIE_NAME);
  return response;
}
