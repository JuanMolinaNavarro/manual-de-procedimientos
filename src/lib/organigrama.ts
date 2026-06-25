import { prisma } from './prisma';

// ─── Sub-tipos del CV (columnas Json) ──────────────────────────────────────────

export interface Experiencia {
  role: string;
  company: string;
  period: string;
  gray?: boolean;
}

export interface HardSkill {
  name: string;
  level: number; // 0-100
  label?: string; // Básico | Intermedio | Avanzado
}

export interface SoftSkill {
  name: string;
  rating: number; // 1-5
}

// ─── Empleado ───────────────────────────────────────────────────────────────

export interface OrgEmpleado {
  id: number;
  nombre: string;
  rol: string;
  area: string;
  manager_id: number | null;
  email: string | null;
  telefono: string | null;
  movil: string | null;
  foto_archivo: string | null;
  estado: string; // active | inactive
  sede: string | null;
  horario: string | null;
  modalidad: string | null;
  guardias: string | null;
  actualizado: string | null;
  summary: string | null;
  antiguedad: string | null;
  formacion: string | null;
  seniority: string | null;
  especialidad: string | null;
  experiencia: Experiencia[] | null;
  resp_primarias: string[] | null;
  resp_secundarias: string[] | null;
  inputs: string[] | null;
  outputs: string[] | null;
  hard_skills: HardSkill[] | null;
  soft_skills: SoftSkill[] | null;
  skills: string[] | null;
  projects: string[] | null;
  proyectos_actuales: string[] | null;
  free_x: number | null;
  free_y: number | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateOrgEmpleadoData {
  nombre: string;
  rol: string;
  area: string;
  manager_id?: number | null;
  email?: string | null;
  telefono?: string | null;
  movil?: string | null;
  estado?: string;
  sede?: string | null;
  horario?: string | null;
  modalidad?: string | null;
  guardias?: string | null;
  actualizado?: string | null;
  summary?: string | null;
  antiguedad?: string | null;
  formacion?: string | null;
  seniority?: string | null;
  especialidad?: string | null;
  experiencia?: Experiencia[] | null;
  resp_primarias?: string[] | null;
  resp_secundarias?: string[] | null;
  inputs?: string[] | null;
  outputs?: string[] | null;
  hard_skills?: HardSkill[] | null;
  soft_skills?: SoftSkill[] | null;
  skills?: string[] | null;
  projects?: string[] | null;
  proyectos_actuales?: string[] | null;
  free_x?: number | null;
  free_y?: number | null;
  created_by?: string | null;
  updated_by?: string | null;
}

export type UpdateOrgEmpleadoData = Partial<Omit<CreateOrgEmpleadoData, 'created_by'>>;

// ─── Área ─────────────────────────────────────────────────────────────────────

export interface OrgArea {
  id: number;
  nombre: string;
  color: string;
  is_top: boolean;
  pos_x: number | null;
  pos_y: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateOrgAreaData {
  nombre: string;
  color?: string;
  is_top?: boolean;
  pos_x?: number | null;
  pos_y?: number | null;
}

export type UpdateOrgAreaData = Partial<CreateOrgAreaData>;

// ─── Línea (relación especial) ──────────────────────────────────────────────

export interface OrgLinea {
  id: number;
  from_id: number;
  to_id: number;
  tipo: string; // special | report-override
  estilo: string; // solid | dashed | dotted
  color: string;
  etiqueta: string | null;
  created_at: Date;
}

export interface CreateOrgLineaData {
  from_id: number;
  to_id: number;
  tipo?: string;
  estilo?: string;
  color?: string;
  etiqueta?: string | null;
}

export interface UpdateOrgLineaData extends Partial<Omit<CreateOrgLineaData, 'from_id' | 'to_id'>> {
  from_id?: number;
  to_id?: number;
}

export interface OrganigramaCompleto {
  empleados: OrgEmpleado[];
  areas: OrgArea[];
  lineas: OrgLinea[];
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

// Las columnas Json llegan como JsonValue; las casteamos a sus tipos concretos.
/* eslint-disable @typescript-eslint/no-explicit-any */
function mapEmpleado(row: any): OrgEmpleado {
  return {
    ...row,
    experiencia: row.experiencia as Experiencia[] | null,
    resp_primarias: row.resp_primarias as string[] | null,
    resp_secundarias: row.resp_secundarias as string[] | null,
    inputs: row.inputs as string[] | null,
    outputs: row.outputs as string[] | null,
    hard_skills: row.hard_skills as HardSkill[] | null,
    soft_skills: row.soft_skills as SoftSkill[] | null,
    skills: row.skills as string[] | null,
    projects: row.projects as string[] | null,
    proyectos_actuales: row.proyectos_actuales as string[] | null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ─── Empleado CRUD ──────────────────────────────────────────────────────────

export async function getAllEmpleados(): Promise<OrgEmpleado[]> {
  const rows = await prisma.orgEmpleado.findMany({ orderBy: { id: 'asc' } });
  return rows.map(mapEmpleado);
}

export async function getEmpleadoById(id: number): Promise<OrgEmpleado | null> {
  const row = await prisma.orgEmpleado.findUnique({ where: { id } });
  return row ? mapEmpleado(row) : null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function createEmpleado(data: CreateOrgEmpleadoData): Promise<OrgEmpleado> {
  const row = await prisma.orgEmpleado.create({
    data: {
      nombre: data.nombre,
      rol: data.rol,
      area: data.area,
      manager_id: data.manager_id ?? null,
      email: data.email ?? null,
      telefono: data.telefono ?? null,
      movil: data.movil ?? null,
      estado: data.estado ?? 'active',
      sede: data.sede ?? null,
      horario: data.horario ?? null,
      modalidad: data.modalidad ?? null,
      guardias: data.guardias ?? null,
      actualizado: data.actualizado ?? null,
      summary: data.summary ?? null,
      antiguedad: data.antiguedad ?? null,
      formacion: data.formacion ?? null,
      seniority: data.seniority ?? null,
      especialidad: data.especialidad ?? null,
      experiencia: (data.experiencia ?? undefined) as any,
      resp_primarias: (data.resp_primarias ?? undefined) as any,
      resp_secundarias: (data.resp_secundarias ?? undefined) as any,
      inputs: (data.inputs ?? undefined) as any,
      outputs: (data.outputs ?? undefined) as any,
      hard_skills: (data.hard_skills ?? undefined) as any,
      soft_skills: (data.soft_skills ?? undefined) as any,
      skills: (data.skills ?? undefined) as any,
      projects: (data.projects ?? undefined) as any,
      proyectos_actuales: (data.proyectos_actuales ?? undefined) as any,
      free_x: data.free_x ?? null,
      free_y: data.free_y ?? null,
      created_by: data.created_by ?? null,
      updated_by: data.updated_by ?? null,
    },
  });
  return mapEmpleado(row);
}

export async function updateEmpleado(
  id: number,
  data: UpdateOrgEmpleadoData,
): Promise<OrgEmpleado | null> {
  const existing = await prisma.orgEmpleado.findUnique({ where: { id } });
  if (!existing) return null;
  const json = (v: unknown) => (v === undefined ? undefined : (v as any));
  const row = await prisma.orgEmpleado.update({
    where: { id },
    data: {
      nombre: data.nombre ?? undefined,
      rol: data.rol ?? undefined,
      area: data.area ?? undefined,
      manager_id: data.manager_id,
      email: data.email,
      telefono: data.telefono,
      movil: data.movil,
      estado: data.estado ?? undefined,
      sede: data.sede,
      horario: data.horario,
      modalidad: data.modalidad,
      guardias: data.guardias,
      actualizado: data.actualizado,
      summary: data.summary,
      antiguedad: data.antiguedad,
      formacion: data.formacion,
      seniority: data.seniority,
      especialidad: data.especialidad,
      experiencia: json(data.experiencia),
      resp_primarias: json(data.resp_primarias),
      resp_secundarias: json(data.resp_secundarias),
      inputs: json(data.inputs),
      outputs: json(data.outputs),
      hard_skills: json(data.hard_skills),
      soft_skills: json(data.soft_skills),
      skills: json(data.skills),
      projects: json(data.projects),
      proyectos_actuales: json(data.proyectos_actuales),
      free_x: data.free_x,
      free_y: data.free_y,
      updated_by: data.updated_by,
    },
  });
  return mapEmpleado(row);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Borra un empleado y limpia las referencias colgantes: las líneas especiales que
 * lo tocan (from/to) y el manager_id de sus subordinados (el schema ya hace
 * SetNull sobre la relación, pero lo hacemos explícito por claridad).
 */
export async function deleteEmpleado(id: number): Promise<boolean> {
  const existing = await prisma.orgEmpleado.findUnique({ where: { id } });
  if (!existing) return false;
  await prisma.$transaction([
    prisma.orgLinea.deleteMany({ where: { OR: [{ from_id: id }, { to_id: id }] } }),
    prisma.orgEmpleado.updateMany({ where: { manager_id: id }, data: { manager_id: null } }),
    prisma.orgEmpleado.delete({ where: { id } }),
  ]);
  return true;
}

export async function setFotoEmpleado(id: number, filename: string | null): Promise<void> {
  await prisma.orgEmpleado.update({ where: { id }, data: { foto_archivo: filename } });
}

/**
 * ¿Asignar `managerId` como jefe de `empleadoId` crearía un ciclo? Devuelve true
 * si es seguro (sin ciclo). Recorre la cadena de jefes hacia arriba. Paridad con
 * la validación anti-ciclos del HTML original.
 */
export async function validateNoCycle(empleadoId: number, managerId: number | null): Promise<boolean> {
  if (managerId == null) return true;
  if (managerId === empleadoId) return false;
  const all = await prisma.orgEmpleado.findMany({ select: { id: true, manager_id: true } });
  const byId = new Map(all.map((e) => [e.id, e.manager_id]));
  const seen = new Set<number>();
  let cur: number | null = managerId;
  while (cur != null) {
    if (cur === empleadoId) return false; // se cerraría el ciclo
    if (seen.has(cur)) break; // ciclo preexistente: cortar
    seen.add(cur);
    cur = byId.get(cur) ?? null;
  }
  return true;
}

// ─── Área CRUD ──────────────────────────────────────────────────────────────

export async function getAllAreas(): Promise<OrgArea[]> {
  return prisma.orgArea.findMany({ orderBy: { id: 'asc' } }) as Promise<OrgArea[]>;
}

export async function getAreaById(id: number): Promise<OrgArea | null> {
  return prisma.orgArea.findUnique({ where: { id } }) as Promise<OrgArea | null>;
}

export async function createArea(data: CreateOrgAreaData): Promise<OrgArea> {
  return prisma.orgArea.create({
    data: {
      nombre: data.nombre,
      color: data.color ?? '#86868b',
      is_top: data.is_top ?? false,
      pos_x: data.pos_x ?? null,
      pos_y: data.pos_y ?? null,
    },
  }) as Promise<OrgArea>;
}

/**
 * Actualiza un área. Si cambia el nombre, migra los empleados del área anterior al
 * nuevo nombre (en transacción), igual que el "renombrar (migra los empleados)" del HTML.
 */
export async function updateArea(id: number, data: UpdateOrgAreaData): Promise<OrgArea | null> {
  const existing = await prisma.orgArea.findUnique({ where: { id } });
  if (!existing) return null;
  const renaming = data.nombre != null && data.nombre !== existing.nombre;
  const updateOp = prisma.orgArea.update({
    where: { id },
    data: {
      nombre: data.nombre ?? undefined,
      color: data.color ?? undefined,
      is_top: data.is_top ?? undefined,
      pos_x: data.pos_x,
      pos_y: data.pos_y,
    },
  });
  if (renaming) {
    const [row] = await prisma.$transaction([
      updateOp,
      prisma.orgEmpleado.updateMany({
        where: { area: existing.nombre },
        data: { area: data.nombre! },
      }),
    ]);
    return row as OrgArea;
  }
  return (await updateOp) as OrgArea;
}

/**
 * Elimina un área. Los empleados NO se borran: quedan "flotando" (su `area` deja de
 * matchear un OrgArea existente y el lienzo los renderiza sueltos), igual que el HTML.
 */
export async function deleteArea(id: number): Promise<boolean> {
  const existing = await prisma.orgArea.findUnique({ where: { id } });
  if (!existing) return false;
  await prisma.orgArea.delete({ where: { id } });
  return true;
}

// ─── Línea CRUD ─────────────────────────────────────────────────────────────

export async function getAllLineas(): Promise<OrgLinea[]> {
  return prisma.orgLinea.findMany({ orderBy: { id: 'asc' } }) as Promise<OrgLinea[]>;
}

export async function createLinea(data: CreateOrgLineaData): Promise<OrgLinea> {
  return prisma.orgLinea.create({
    data: {
      from_id: data.from_id,
      to_id: data.to_id,
      tipo: data.tipo ?? 'special',
      estilo: data.estilo ?? 'solid',
      color: data.color ?? '#86868b',
      etiqueta: data.etiqueta ?? null,
    },
  }) as Promise<OrgLinea>;
}

export async function updateLinea(id: number, data: UpdateOrgLineaData): Promise<OrgLinea | null> {
  const existing = await prisma.orgLinea.findUnique({ where: { id } });
  if (!existing) return null;
  return prisma.orgLinea.update({
    where: { id },
    data: {
      from_id: data.from_id ?? undefined,
      to_id: data.to_id ?? undefined,
      tipo: data.tipo ?? undefined,
      estilo: data.estilo ?? undefined,
      color: data.color ?? undefined,
      etiqueta: data.etiqueta,
    },
  }) as Promise<OrgLinea>;
}

export async function deleteLinea(id: number): Promise<boolean> {
  const existing = await prisma.orgLinea.findUnique({ where: { id } });
  if (!existing) return false;
  await prisma.orgLinea.delete({ where: { id } });
  return true;
}

// ─── Agregado (bootstrap del lienzo) ──────────────────────────────────────────

export async function getOrganigramaCompleto(): Promise<OrganigramaCompleto> {
  const [empleados, areas, lineas] = await Promise.all([
    getAllEmpleados(),
    getAllAreas(),
    getAllLineas(),
  ]);
  return { empleados, areas, lineas };
}
