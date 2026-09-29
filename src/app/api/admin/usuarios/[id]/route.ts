/**
 * API Route: /api/admin/usuarios/[id]
 *
 * GET - Obtiene un usuario por id (solo superadmin)
 * PUT - Actualiza usuario (solo superadmin). Solo un superadmin puede asignar el rol
 *       superadmin o editar a un usuario superadmin. `empleado_id` vincula la
 *       ficha del organigrama (null = desvincular). `password` vacía = no cambiarla (se
 *       guarda hasheada; nunca se devuelve). Cambiar usuario, contraseña, rol o estado
 *       cierra todas sus sesiones abiertas.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ADMIN_MODULO_SLUGS } from '@/lib/modulos';
import { isSuperadmin, ROLES } from '@/lib/roles';
import { getUsuarioSesion, puedeGestionarUsuariosSesion } from '@/lib/admin-auth';
import { hashPassword, validarPasswordNueva } from '@/lib/password';
import { revocarSesionesDeUsuario } from '@/lib/sesion';
import { SELECT_USUARIO } from '@/lib/usuarios-select';

/** Gestión de usuarios: solo superadmin (rol de la base). Ver roles.ts › puedeGestionarUsuarios. */
async function isAdmin(): Promise<boolean> {
  return puedeGestionarUsuariosSesion();
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'Solo un superadmin puede gestionar usuarios' }, { status: 403 });
    }

    const { id } = await params;
    const usuarioId = Number(id);

    if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
      return NextResponse.json({ error: 'ID invalido' }, { status: 400 });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: SELECT_USUARIO,
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
      return NextResponse.json({ error: 'Solo un superadmin puede gestionar usuarios' }, { status: 403 });
    }

    const { id } = await params;
    const usuarioId = Number(id);

    if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
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

    const passwordNueva = body.password?.trim() || undefined;
    if (passwordNueva !== undefined) {
      const errorPassword = validarPasswordNueva(passwordNueva);
      if (errorPassword) {
        return NextResponse.json({ error: errorPassword }, { status: 400 });
      }
    }

    const data = {
      usuario: body.usuario?.trim() || undefined,
      password: passwordNueva !== undefined ? await hashPassword(passwordNueva) : undefined,
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
      select: { rol: true, usuario: true, isActive: true },
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
      select: SELECT_USUARIO,
    });

    const cambioAcceso =
      data.password !== undefined ||
      (data.usuario !== undefined && data.usuario !== target.usuario) ||
      (data.rol !== undefined && data.rol !== target.rol) ||
      (data.isActive !== undefined && data.isActive !== target.isActive);
    if (cambioAcceso) await revocarSesionesDeUsuario(usuarioId);

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
