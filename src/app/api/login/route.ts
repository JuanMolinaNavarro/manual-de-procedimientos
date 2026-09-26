/**
 * API Route: /api/login
 *
 * POST - Valida usuario/contraseña (scrypt; migra las viejas en texto plano al entrar) y
 *        abre una sesión en la base. La cookie lleva solo un token opaco (ver `sesion.ts`).
 * DELETE - Revoca la sesión y borra la cookie.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { COOKIE_SESION, SESION_HORAS, crearSesion, revocarSesion } from '@/lib/sesion';
import { hashPassword, verificarPassword } from '@/lib/password';
import { bloqueoVigente, esperaIp, falloUsuario, ipCliente, registrarFalloIp } from '@/lib/login-limite';

const CREDENCIALES_INVALIDAS = 'Credenciales invalidas';

/**
 * Instalación nueva (tabla vacía): crea el primer usuario, superadmin, con SITE_USER /
 * SITE_PASSWORD. Es el único rol que gestiona usuarios; si el primero fuera admin, nadie
 * podría dar de alta ni ascender a nadie.
 */
async function ensureSeedUser() {
  const envUser = process.env.SITE_USER;
  const envPass = process.env.SITE_PASSWORD;
  if (!envUser || !envPass) return;
  if ((await prisma.usuario.count()) > 0) return;
  await prisma.usuario.create({
    data: { usuario: envUser, password: await hashPassword(envPass), rol: 'superadmin' },
  });
}

function esHttps(request: NextRequest): boolean {
  const proto = (request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol).split(',')[0].trim();
  return proto === 'https' || proto === 'https:';
}

function demasiados(segundos: number) {
  const minutos = Math.max(1, Math.ceil(segundos / 60));
  return NextResponse.json(
    { error: `Demasiados intentos. Probá de nuevo en ${minutos} minuto${minutos === 1 ? '' : 's'}.` },
    { status: 429, headers: { 'Retry-After': String(segundos) } },
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { usuario?: unknown; password?: unknown };
    const usuario = typeof body.usuario === 'string' ? body.usuario.trim() : '';
    const password = typeof body.password === 'string' ? body.password.trim() : '';

    if (!usuario || !password) {
      return NextResponse.json({ error: 'Usuario y contrasena son requeridos' }, { status: 400 });
    }

    const ip = ipCliente(request.headers);
    const esperaPorIp = esperaIp(ip);
    if (esperaPorIp > 0) return demasiados(esperaPorIp);

    await ensureSeedUser();

    const record = await prisma.usuario.findUnique({ where: { usuario } });
    if (!record) {
      registrarFalloIp(ip);
      return NextResponse.json({ error: CREDENCIALES_INVALIDAS }, { status: 401 });
    }

    const espera = bloqueoVigente(record.login_bloqueado_hasta);
    if (espera > 0) return demasiados(espera);

    const { ok, rehash } = await verificarPassword(password, record.password);
    if (!ok) {
      registrarFalloIp(ip);
      await prisma.usuario.update({ where: { id: record.id }, data: falloUsuario(record.login_fallos) });
      return NextResponse.json({ error: CREDENCIALES_INVALIDAS }, { status: 401 });
    }

    if (record.isActive !== true) {
      return NextResponse.json({ error: 'Usuario inactivo' }, { status: 403 });
    }

    await prisma.usuario.update({
      where: { id: record.id },
      data: {
        login_fallos: 0,
        login_bloqueado_hasta: null,
        ...(rehash ? { password: await hashPassword(password) } : {}),
      },
    });

    const { token } = await crearSesion(record.id, { ip, userAgent: request.headers.get('user-agent') });
    const response = NextResponse.json({ ok: true, rol: record.rol });
    response.cookies.set(COOKIE_SESION, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: esHttps(request),
      path: '/',
      maxAge: SESION_HORAS * 3600,
    });
    return response;
  } catch (error) {
    console.error('Error en POST /api/login:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get(COOKIE_SESION)?.value;
    if (token) await revocarSesion(token);
  } catch (error) {
    console.error('Error en DELETE /api/login:', error);
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(COOKIE_SESION);
  return response;
}
