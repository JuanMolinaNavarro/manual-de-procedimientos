import { NextResponse } from 'next/server';
import { getAllOrganigramas } from '@/lib/organigrama';
import { prisma } from '@/lib/prisma';
import { cargarEstado, guardarConfig } from '@/lib/vacaciones';
import { conSesion, leerJson } from '@/lib/vacaciones-api';

export const dynamic = 'force-dynamic';

/**
 * Foto de la temporada para RR.HH. (el cliente deriva tablero, calendario y alertas con el mismo
 * motor que valida el servidor). El sueldo viaja solo si la sesión también puede ver Nómina.
 */
export async function GET(request: Request) {
  return conSesion(request, 'GET /api/admin/vacaciones', true, async (s) => {
    const [estado, organigramas] = await Promise.all([cargarEstado(prisma, s.verSueldos), getAllOrganigramas()]);
    return NextResponse.json({ estado, organigramas: organigramas.map((o) => ({ id: o.id, nombre: o.nombre })), verSueldos: s.verSueldos });
  });
}

/** Parámetros de la temporada (cambio parcial). */
export async function PATCH(request: Request) {
  return conSesion(request, 'PATCH /api/admin/vacaciones', true, async (s) => {
    return NextResponse.json({ config: await guardarConfig(await leerJson(request), s.actor) });
  });
}
