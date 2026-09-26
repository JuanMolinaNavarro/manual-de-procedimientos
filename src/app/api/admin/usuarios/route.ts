/**
 * API Route: /api/admin/usuarios
 *
 * GET - Lista usuarios (solo superadmin)
 * POST - Crea usuario (solo superadmin). Solo un superadmin puede crear superadmins.
 *        Opcionalmente vincula la ficha del organigrama: `empleado_id` (existente)
 *        o `area_id` (crea una ficha nueva en esa área, en transacción).
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isSuperadmin, ROLES } from '@/lib/roles';
import { getUsuarioSesion, puedeGestionarUsuariosSesion } from '@/lib/admin-auth';
import { hashPassword, validarPasswordNueva } from '@/lib/password';
import { SELECT_USUARIO } from '@/lib/usuarios-select';

/** Gestión de usuarios: solo superadmin (rol de la base). Ver roles.ts › puedeGestionarUsuarios. */
async function isAdmin(): Promise<boolean> {
  return puedeGestionarUsuariosSesion();
}

export async function GET() {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'Solo un superadmin puede gestionar usuarios' }, { status: 403 });
    }

    const usuarios = await prisma.usuario.findMany({
      orderBy: { id: 'desc' },
      select: SELECT_USUARIO,
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
      return NextResponse.json({ error: 'Solo un superadmin puede gestionar usuarios' }, { status: 403 });
    }

    const body = (await request.json()) as {
      usuario?: string;
      password?: string;
      rol?: string;
      nombre?: string;
      apellido?: string;
      empleado_id?: number;
      area_id?: number;
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

    const errorPassword = validarPasswordNueva(password);
    if (errorPassword) {
      return NextResponse.json({ error: errorPassword }, { status: 400 });
    }

    if (!(ROLES as readonly string[]).includes(rol)) {
      return NextResponse.json(
        { error: 'Rol invalido' },
        { status: 400 }
      );
    }

    if (isSuperadmin(rol)) {
      const sesion = await getUsuarioSesion();
      if (!isSuperadmin(sesion?.rol)) {
        return NextResponse.json(
          { error: 'Solo un superadmin puede crear superadmins' },
          { status: 403 }
        );
      }
    }

    const empleadoId = typeof body.empleado_id === 'number' ? body.empleado_id : null;
    const areaId = typeof body.area_id === 'number' ? body.area_id : null;
    if (empleadoId && areaId) {
      return NextResponse.json(
        { error: 'Elegir ficha existente o area, no ambas' },
        { status: 400 }
      );
    }

    const baseData = {
      usuario,
      password: await hashPassword(password),
      rol,
      nombre: nombre || null,
      apellido: apellido || null,
      isActive: true,
    };

    let created;
    if (empleadoId) {
      const empleado = await prisma.orgEmpleado.findUnique({ where: { id: empleadoId } });
      if (!empleado) {
        return NextResponse.json({ error: 'La ficha del organigrama no existe' }, { status: 400 });
      }
      created = await prisma.usuario.create({
        data: { ...baseData, empleado_id: empleadoId },
        select: SELECT_USUARIO,
      });
    } else if (areaId) {
      const area = await prisma.orgArea.findUnique({ where: { id: areaId } });
      if (!area) {
        return NextResponse.json({ error: 'El area no existe' }, { status: 400 });
      }
      const sesion = await getUsuarioSesion();
      // Ficha nueva + usuario en una transacción: si algo falla no quedan huérfanos.
      created = await prisma.$transaction(async (tx) => {
        const ficha = await tx.orgEmpleado.create({
          data: {
            organigrama_id: area.organigrama_id,
            nombre: [nombre, apellido].filter(Boolean).join(' ') || usuario,
            rol: 'Sin definir',
            area: area.nombre,
            created_by: sesion?.usuario ?? null,
          },
        });
        return tx.usuario.create({
          data: { ...baseData, empleado_id: ficha.id },
          select: SELECT_USUARIO,
        });
      });
    } else {
      created = await prisma.usuario.create({ data: baseData, select: SELECT_USUARIO });
    }

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = String((error.meta?.target as string[] | string) ?? '');
      if (target.includes('empleado_id')) {
        return NextResponse.json(
          { error: 'Esa ficha del organigrama ya esta vinculada a otro usuario' },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: 'El usuario ya existe' }, { status: 400 });
    }
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json({ error: 'El usuario ya existe' }, { status: 400 });
    }
    console.error('Error en POST /api/admin/usuarios:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
