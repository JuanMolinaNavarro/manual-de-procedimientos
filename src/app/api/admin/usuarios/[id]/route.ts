/**
 * API Route: /api/admin/usuarios/[id]
 *
 * GET - Obtiene un usuario por id (admin)
 * PUT - Actualiza usuario (admin). Solo un superadmin puede asignar el rol
 *       superadmin o editar a un usuario superadmin. `empleado_id` vincula la
 *       ficha del organigrama (null = desvincular).
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { ADMIN_MODULO_SLUGS } from '@/lib/modulos';
import { isAdminRole, isSuperadmin, ROLES } from '@/lib/roles';
import { getUsuarioSesion } from '@/lib/admin-auth';

function getRoleFromSession(value: string | undefined) {
  if (!value) return null;
  const parts = value.split('|');
  return parts.length > 1 ? parts[1] : null;
}

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get('site_session');
  const role = getRoleFromSession(session?.value);
  return isAdminRole(role);
}

const INCLUDE_EMPLEADO = {
  empleado: { select: { id: true, nombre: true, area: true } },
} as const;

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
      include: INCLUDE_EMPLEADO,
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
      empleado_id?: number | null;
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

    if (data.rol && !(ROLES as readonly string[]).includes(data.rol)) {
      return NextResponse.json({ error: 'Rol invalido' }, { status: 400 });
    }

    const target = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { rol: true },
    });
    if (!target) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Superadmins: solo otro superadmin puede tocarlos o promover a alguien.
    if (isSuperadmin(target.rol) || isSuperadmin(data.rol)) {
      const sesion = await getUsuarioSesion();
      if (!isSuperadmin(sesion?.rol)) {
        return NextResponse.json(
          { error: 'Solo un superadmin puede gestionar superadmins' },
          { status: 403 }
        );
      }
    }

    // empleado_id: undefined = no tocar; null = desvincular; number = vincular.
    let empleadoId: number | null | undefined = undefined;
    if ('empleado_id' in body) {
      if (body.empleado_id === null) {
        empleadoId = null;
      } else if (typeof body.empleado_id === 'number') {
        const empleado = await prisma.orgEmpleado.findUnique({ where: { id: body.empleado_id } });
        if (!empleado) {
          return NextResponse.json({ error: 'La ficha del organigrama no existe' }, { status: 400 });
        }
        empleadoId = body.empleado_id;
      }
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
        empleado_id: empleadoId,
      },
      include: INCLUDE_EMPLEADO,
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Esa ficha del organigrama ya esta vinculada a otro usuario' },
        { status: 400 }
      );
    }
    console.error('Error en PUT /api/admin/usuarios/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
