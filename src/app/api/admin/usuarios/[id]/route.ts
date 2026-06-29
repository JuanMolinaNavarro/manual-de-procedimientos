/**
 * API Route: /api/admin/usuarios/[id]
 *
 * GET - Obtiene un usuario por id (admin)
 * PUT - Actualiza usuario (admin)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { ADMIN_MODULO_SLUGS } from '@/lib/modulos';

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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const usuarioId = Number(id);

    if (Number.isNaN(usuarioId)) {
      return NextResponse.json({ error: 'ID invalido' }, { status: 400 });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
    });

    if (!usuario) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    return NextResponse.json(usuario);
  } catch (error) {
    console.error('Error en GET /api/admin/usuarios/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
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
    const usuarioId = Number(id);

    if (Number.isNaN(usuarioId)) {
      return NextResponse.json({ error: 'ID invalido' }, { status: 400 });
    }

    const body = (await request.json()) as {
      usuario?: string;
      password?: string;
      rol?: string;
      nombre?: string;
      apellido?: string;
      isActive?: boolean;
      modulos?: string[];
      modulos_edit?: string[];
    };

    const data = {
      usuario: body.usuario?.trim(),
      password: body.password?.trim(),
      rol: body.rol?.trim(),
      nombre: body.nombre?.trim() || null,
      apellido: body.apellido?.trim() || null,
      isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
      modulos: Array.isArray(body.modulos) ? body.modulos : undefined,
      modulos_edit: Array.isArray(body.modulos_edit) ? body.modulos_edit : undefined,
    };

    if (data.rol && data.rol !== 'admin' && data.rol !== 'agente') {
      return NextResponse.json({ error: 'Rol invalido' }, { status: 400 });
    }

    if (data.modulos) {
      const invalid = data.modulos.filter((s) => !ADMIN_MODULO_SLUGS.includes(s as never));
      if (invalid.length > 0) {
        return NextResponse.json({ error: `Modulos invalidos: ${invalid.join(', ')}` }, { status: 400 });
      }
    }

    if (data.modulos_edit) {
      const invalid = data.modulos_edit.filter((s) => !ADMIN_MODULO_SLUGS.includes(s as never));
      if (invalid.length > 0) {
        return NextResponse.json({ error: `Modulos invalidos: ${invalid.join(', ')}` }, { status: 400 });
      }
    }

    const updated = await prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        usuario: data.usuario ?? undefined,
        password: data.password ?? undefined,
        rol: data.rol ?? undefined,
        nombre: data.nombre ?? undefined,
        apellido: data.apellido ?? undefined,
        isActive: data.isActive ?? undefined,
        modulos: data.modulos ?? undefined,
        modulos_edit: data.modulos_edit ?? undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error en PUT /api/admin/usuarios/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
