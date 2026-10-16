/**
 * API Route: /api/admin/usuarios/fichas
 *
 * GET - Las fichas del organigrama para vincular a un usuario (solo superadmin): puesto, área,
 *       lugar (organigrama), CUIL del Maestro de Nómina y quién la tiene vinculada. Vive acá y no
 *       en `/api/admin/organigrama/empleados` para no mostrarle el CUIL a todo el que ve el
 *       organigrama. Sin convenio ni otros datos de la ficha.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { puedeGestionarUsuariosSesion } from '@/lib/admin-auth';
import type { FichaOpcion } from '@/lib/fichas-busqueda';

export async function GET() {
  try {
    if (!(await puedeGestionarUsuariosSesion())) {
      return NextResponse.json({ error: 'Solo un superadmin puede gestionar usuarios' }, { status: 403 });
    }

    // La ficha guarda solo `organigrama_id` (sin relación en el esquema).
    const [rows, organigramas] = await Promise.all([prisma.orgEmpleado.findMany({
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        nombre: true,
        rol: true,
        area: true,
        oculto_en: true,
        organigrama_id: true,
        nomina: { select: { cuil: true } },
        usuario: { select: { id: true, usuario: true } },
      },
    }), prisma.organigrama.findMany({ select: { id: true, nombre: true } })]);
    const lugarDe = new Map(organigramas.map((o) => [o.id, o.nombre]));

    const fichas: FichaOpcion[] = rows.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      puesto: r.rol,
      area: r.area,
      lugar: lugarDe.get(r.organigrama_id ?? -1) ?? '',
      cuil: r.nomina?.cuil ?? '',
      oculta: r.oculto_en != null,
      usuario: r.usuario,
    }));
    return NextResponse.json(fichas);
  } catch (error) {
    console.error('Error en GET /api/admin/usuarios/fichas:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
