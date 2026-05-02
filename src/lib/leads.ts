import { prisma } from './prisma';

export interface Lead {
  id: number;
  nombre: string;
  apellido: string;
  telefono: string;
  email: string | null;
  direccion: string;
  plan: string;
  tv_pack: boolean;
  origen: string;
  created_at: Date;
}

export interface CreateLeadData {
  nombre: string;
  apellido: string;
  telefono: string;
  email?: string | null;
  direccion: string;
  plan: string;
  tv_pack?: boolean;
  origen: string;
}

export async function getAllLeads(): Promise<Lead[]> {
  return prisma.lead.findMany({ orderBy: { created_at: 'desc' } });
}

export async function createLead(data: CreateLeadData): Promise<Lead> {
  return prisma.lead.create({
    data: {
      nombre: data.nombre,
      apellido: data.apellido,
      telefono: data.telefono,
      email: data.email ?? null,
      direccion: data.direccion,
      plan: data.plan,
      tv_pack: data.tv_pack ?? false,
      origen: data.origen,
    },
  });
}
