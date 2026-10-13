/**
 * API Route: /api/admin/usuarios
 *
 * GET - Lista usuarios (solo superadmin)
 * POST - Crea usuario (solo superadmin). Solo un superadmin puede crear superadmins.
 *        Opcionalmente vincula la ficha del organigrama: `empleado_id` (existente)
 *        o `area_id` (crea una ficha nueva en esa área, en transacción). El alta queda en
 *        `auditoria` (quién la hizo y desde qué IP).
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isSuperadmin, ROLES } from '@/lib/roles';
import { getUsuarioSesion, puedeGestionarUsuariosSesion } from '@/lib/admin-auth';
import { hashSecreto, validarPasswordNueva } from '@/lib/password';
import { SELECT_USUARIO } from '@/lib/usuarios-select';
import { actorDe, auditar } from '@/lib/auditoria';

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
    const rol = body.rol?.trim() || 'admin';
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
      password: await hashSecreto(password),
      rol,
      nombre: nombre || null,
      apellido: apellido || null,
      isActive: true,
    };

    if (empleadoId && !(await prisma.orgEmpleado.findUnique({ where: { id: empleadoId } }))) {
      return NextResponse.json({ error: 'La ficha del organigrama no existe' }, { status: 400 });
    }
    const area = areaId ? await prisma.orgArea.findUnique({ where: { id: areaId } }) : null;
    if (areaId && !area) {
      return NextResponse.json({ error: 'El area no existe' }, { status: 400 });
    }
    const actor = await actorDe(request);
    // Ficha nueva (si va por área) + usuario + auditoría en una transacción: si algo falla no
    // quedan huérfanos ni un alta sin registrar.
    const created = await prisma.$transaction(async (tx) => {
      const ficha = area
        ? await tx.orgEmpleado.create({
            data: {
              organigrama_id: area.organigrama_id,
              nombre: [nombre, apellido].filter(Boolean).join(' ') || usuario,
              rol: 'Sin definir',
              area: area.nombre,
              created_by: actor.usuario,
            },
          })
        : null;
      const u = await tx.usuario.create({
        data: { ...baseData, empleado_id: ficha?.id ?? empleadoId },
        select: SELECT_USUARIO,
      });
      await auditar(actor, 'usuario.alta', { usuarioId: u.id, detalle: `${usuario} · rol ${rol}` }, tx);
      return u;
    });

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
