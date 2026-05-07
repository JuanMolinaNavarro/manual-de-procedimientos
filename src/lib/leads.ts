import { prisma } from './prisma';

export interface Lead {
  id: number;
  nombre: string | null;
  apellido: string | null;
  telefono: string;
  email: string | null;
  direccion: string | null;
  plan: string | null;
  tv_pack: boolean | null;
  origen: string;
  contactado: boolean | null;
  resultado: string | null;
  created_at: Date;
}

export interface CreateLeadData {
  nombre?: string | null;
  apellido?: string | null;
  telefono: string;
  email?: string | null;
  direccion?: string | null;
  plan?: string | null;
  tv_pack?: boolean | null;
  origen: string;
}

export async function getAllLeads(): Promise<Lead[]> {
  return prisma.lead.findMany({ orderBy: { created_at: 'desc' } });
}

export async function updateLead(
  id: number,
  data: { contactado?: boolean; resultado?: string | null },
): Promise<Lead> {
  return prisma.lead.update({ where: { id }, data });
}

export async function createLead(data: CreateLeadData): Promise<Lead> {
  return prisma.lead.create({
    data: {
      nombre: data.nombre ?? null,
      apellido: data.apellido ?? null,
      telefono: data.telefono,
      email: data.email ?? null,
      direccion: data.direccion ?? null,
      plan: data.plan ?? null,
      tv_pack: data.tv_pack ?? false,
      origen: data.origen,
    },
  });
}
