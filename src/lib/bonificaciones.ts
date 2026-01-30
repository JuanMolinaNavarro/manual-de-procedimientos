/**
 * bonificaciones.ts - Acceso a datos con Prisma
 *
 * Contiene operaciones CRUD y lógica de filtrado por empresa y vigencia.
 */

import { prisma } from './prisma';
import { type Empresa } from './empresas';

export interface Bonificacion {
  id: number;
  empresa: Empresa | string;
  titulo: string;
  descripcion: string | null;
  mensaje_sugerido: string | null;
  condiciones: string | null;
  activa: boolean;
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateBonificacionData {
  empresa: Empresa;
  titulo: string;
  descripcion?: string;
  mensaje_sugerido?: string;
  condiciones?: string;
  vigencia_desde?: string | null;
  vigencia_hasta?: string | null;
}

export interface UpdateBonificacionData {
  empresa?: Empresa;
  titulo?: string;
  descripcion?: string;
  mensaje_sugerido?: string;
  condiciones?: string;
  activa?: boolean;
  vigencia_desde?: string | null;
  vigencia_hasta?: string | null;
}

export async function getBonificacionesActivas(
  empresa?: string | null
): Promise<Bonificacion[]> {
  const today = new Date().toISOString().split('T')[0];

  return prisma.bonificacion.findMany({
    where: {
      activa: true,
      ...(empresa ? { empresa } : {}),
      AND: [
        {
          OR: [{ vigencia_desde: null }, { vigencia_desde: { lte: today } }],
        },
        {
          OR: [{ vigencia_hasta: null }, { vigencia_hasta: { gte: today } }],
        },
      ],
    },
    orderBy: { id: 'desc' },
  });
}

export async function getAllBonificaciones(): Promise<Bonificacion[]> {
  return prisma.bonificacion.findMany({
    orderBy: { id: 'desc' },
  });
}

export async function getBonificacionById(id: number): Promise<Bonificacion | null> {
  return prisma.bonificacion.findUnique({ where: { id } });
}

export async function createBonificacion(
  data: CreateBonificacionData
): Promise<Bonificacion> {
  return prisma.bonificacion.create({
    data: {
      empresa: data.empresa,
      titulo: data.titulo,
      descripcion: data.descripcion ?? null,
      mensaje_sugerido: data.mensaje_sugerido ?? null,
      condiciones: data.condiciones ?? null,
      vigencia_desde: data.vigencia_desde ?? null,
      vigencia_hasta: data.vigencia_hasta ?? null,
    },
  });
}

export async function updateBonificacion(
  id: number,
  data: UpdateBonificacionData
): Promise<Bonificacion | null> {
  const existing = await getBonificacionById(id);

  if (!existing) {
    return null;
  }

  return prisma.bonificacion.update({
    where: { id },
    data: {
      empresa: data.empresa ?? undefined,
      titulo: data.titulo ?? undefined,
      descripcion: data.descripcion ?? undefined,
      mensaje_sugerido: data.mensaje_sugerido ?? undefined,
      condiciones: data.condiciones ?? undefined,
      activa: data.activa ?? undefined,
      vigencia_desde: data.vigencia_desde ?? undefined,
      vigencia_hasta: data.vigencia_hasta ?? undefined,
    },
  });
}

export async function softDeleteBonificacion(id: number): Promise<boolean> {
  const result = await prisma.bonificacion.updateMany({
    where: { id },
    data: { activa: false },
  });
  return result.count > 0;
}

export async function activateBonificacion(id: number): Promise<boolean> {
  const result = await prisma.bonificacion.updateMany({
    where: { id },
    data: { activa: true },
  });
  return result.count > 0;
}

export async function deleteBonificacion(id: number): Promise<boolean> {
  const existing = await getBonificacionById(id);
  if (!existing) return false;
  await prisma.bonificacion.delete({ where: { id } });
  return true;
}
