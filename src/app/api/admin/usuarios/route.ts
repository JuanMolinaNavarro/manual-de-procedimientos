/**
 * API Route: /api/admin/usuarios
 *
 * GET - Lista usuarios (admin)
 * POST - Crea usuario (admin). Solo un superadmin puede crear superadmins.
 *        Opcionalmente vincula la ficha del organigrama: `empleado_id` (existente)
 *        o `area_id` (crea una ficha nueva en esa área, en transacción).
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
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

export async function GET() {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const usuarios = await prisma.usuario.findMany({
      orderBy: { id: 'desc' },
      include: INCLUDE_EMPLEADO,
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
      password,
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
        include: INCLUDE_EMPLEADO,
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
          include: INCLUDE_EMPLEADO,
        });
      });
    } else {
      created = await prisma.usuario.create({ data: baseData, include: INCLUDE_EMPLEADO });
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
