import { prisma } from './prisma';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface ContratoComprador {
  id: number;
  nombre_empresa: string;
  ejecutivo_a_cargo: string | null;
  mail_comercial: string | null;
  telefono_comercial: string | null;
  mail_tecnico: string | null;
  telefono_tecnico: string | null;
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
  precio_tipo: string | null;
  precio_valor: string | null;
  subs_minimo_garantizado: string | null;
  reportar_subs: boolean;
  plazas_reportadas: string | null;
  condiciones_pago_contrato: string | null;
  condiciones_pago_acordadas: string | null;
  tnb_aplicada: string | null;
  tecnologias_autorizadas: string[];
  logo_nombre_archivo: string | null;
  activa: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateContratoCompradorData {
  nombre_empresa: string;
  ejecutivo_a_cargo?: string | null;
  mail_comercial?: string | null;
  telefono_comercial?: string | null;
  mail_tecnico?: string | null;
  telefono_tecnico?: string | null;
  vigencia_desde?: string | null;
  vigencia_hasta?: string | null;
  precio_tipo?: string | null;
  precio_valor?: string | null;
  subs_minimo_garantizado?: string | null;
  reportar_subs?: boolean;
  plazas_reportadas?: string | null;
  condiciones_pago_contrato?: string | null;
  condiciones_pago_acordadas?: string | null;
  tnb_aplicada?: string | null;
  tecnologias_autorizadas?: string[];
  created_by?: string | null;
  updated_by?: string | null;
}

export interface UpdateContratoCompradorData extends Partial<Omit<CreateContratoCompradorData, 'created_by'>> {
  activa?: boolean;
  updated_by?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────

export interface EquipoPorSenal {
  signal: string;
  equipment: string;
}

export interface ContratoVendedor {
  id: number;
  nombre_empresa: string;
  documentacion_empresa: string | null;
  ejecutivo_cargo: string | null;
  mail_comercial_cliente: string | null;
  telefono_comercial_cliente: string | null;
  mail_tecnico_cliente: string | null;
  telefono_tecnico_cliente: string | null;
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
  precio_tipo: string | null;
  precio_valor: string | null;
  grilla: string | null;
  subs_minimo_garantizado: string | null;
  subs_reportados_senales: string | null;
  plazas_incluidas_contrato: string | null;
  plazas_reportadas_senales: string | null;
  condiciones_pago: string | null;
  tnb_aplicada: string | null;
  forma_recepcion_entrega: string | null;
  equipos_por_senal: EquipoPorSenal[] | null;
  condiciones_entrega_equipamiento: string | null;
  logo_nombre_archivo: string | null;
  activa: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateContratoVendedorData {
  nombre_empresa: string;
  documentacion_empresa?: string | null;
  ejecutivo_cargo?: string | null;
  mail_comercial_cliente?: string | null;
  telefono_comercial_cliente?: string | null;
  mail_tecnico_cliente?: string | null;
  telefono_tecnico_cliente?: string | null;
  vigencia_desde?: string | null;
  vigencia_hasta?: string | null;
  precio_tipo?: string | null;
  precio_valor?: string | null;
  grilla?: string | null;
  subs_minimo_garantizado?: string | null;
  subs_reportados_senales?: string | null;
  plazas_incluidas_contrato?: string | null;
  plazas_reportadas_senales?: string | null;
  condiciones_pago?: string | null;
  tnb_aplicada?: string | null;
  forma_recepcion_entrega?: string | null;
  equipos_por_senal?: EquipoPorSenal[] | null;
  condiciones_entrega_equipamiento?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface UpdateContratoVendedorData extends Partial<Omit<CreateContratoVendedorData, 'created_by'>> {
  activa?: boolean;
  updated_by?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────

export interface SaltoImporte {
  id: number;
  contrato_comprador_id: number | null;
  contrato_vendedor_id: number | null;
  descripcion: string;
  fecha_efectiva: string;
  dias_aviso_previo: number;
  nuevo_precio: string | null;
  notificado_at: Date | null;
  activa: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateSaltoImporteData {
  contrato_comprador_id?: number | null;
  contrato_vendedor_id?: number | null;
  descripcion: string;
  fecha_efectiva: string;
  dias_aviso_previo?: number;
  nuevo_precio?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────

export interface ArchivoContrato {
  id: number;
  contrato_comprador_id: number | null;
  contrato_vendedor_id: number | null;
  nombre_original: string;
  nombre_archivo: string;
  tipo_mime: string | null;
  tamano: number | null;
  created_by: string | null;
  created_at: Date;
}

// ─── ContratoComprador CRUD ───────────────────────────────────────────────────

export async function getAllContratosComprador(): Promise<ContratoComprador[]> {
  return prisma.contratoComprador.findMany({ orderBy: { id: 'desc' } }) as Promise<ContratoComprador[]>;
}

export async function getContratoCompradorById(id: number): Promise<ContratoComprador | null> {
  return prisma.contratoComprador.findUnique({ where: { id } }) as Promise<ContratoComprador | null>;
}

export async function createContratoComprador(data: CreateContratoCompradorData): Promise<ContratoComprador> {
  return prisma.contratoComprador.create({
    data: {
      nombre_empresa: data.nombre_empresa,
      ejecutivo_a_cargo: data.ejecutivo_a_cargo ?? null,
      mail_comercial: data.mail_comercial ?? null,
      telefono_comercial: data.telefono_comercial ?? null,
      mail_tecnico: data.mail_tecnico ?? null,
      telefono_tecnico: data.telefono_tecnico ?? null,
      vigencia_desde: data.vigencia_desde ?? null,
      vigencia_hasta: data.vigencia_hasta ?? null,
      precio_tipo: data.precio_tipo ?? null,
      precio_valor: data.precio_valor ?? null,
      subs_minimo_garantizado: data.subs_minimo_garantizado ?? null,
      reportar_subs: data.reportar_subs ?? false,
      plazas_reportadas: data.plazas_reportadas ?? null,
      condiciones_pago_contrato: data.condiciones_pago_contrato ?? null,
      condiciones_pago_acordadas: data.condiciones_pago_acordadas ?? null,
      tnb_aplicada: data.tnb_aplicada ?? null,
      tecnologias_autorizadas: data.tecnologias_autorizadas ?? [],
      created_by: data.created_by ?? null,
      updated_by: data.updated_by ?? null,
    },
  }) as Promise<ContratoComprador>;
}

export async function updateContratoComprador(
  id: number,
  data: UpdateContratoCompradorData,
): Promise<ContratoComprador | null> {
  const existing = await getContratoCompradorById(id);
  if (!existing) return null;
  return prisma.contratoComprador.update({
    where: { id },
    data: {
      nombre_empresa: data.nombre_empresa ?? undefined,
      ejecutivo_a_cargo: data.ejecutivo_a_cargo,
      mail_comercial: data.mail_comercial,
      telefono_comercial: data.telefono_comercial,
      mail_tecnico: data.mail_tecnico,
      telefono_tecnico: data.telefono_tecnico,
      vigencia_desde: data.vigencia_desde,
      vigencia_hasta: data.vigencia_hasta,
      precio_tipo: data.precio_tipo,
      precio_valor: data.precio_valor,
      subs_minimo_garantizado: data.subs_minimo_garantizado,
      reportar_subs: data.reportar_subs,
      plazas_reportadas: data.plazas_reportadas,
      condiciones_pago_contrato: data.condiciones_pago_contrato,
      condiciones_pago_acordadas: data.condiciones_pago_acordadas,
      tnb_aplicada: data.tnb_aplicada,
      tecnologias_autorizadas: data.tecnologias_autorizadas,
      activa: data.activa,
      updated_by: data.updated_by,
    },
  }) as Promise<ContratoComprador>;
}

export async function softDeleteContratoComprador(id: number): Promise<boolean> {
  const result = await prisma.contratoComprador.updateMany({
    where: { id },
    data: { activa: false },
  });
  return result.count > 0;
}

export async function deleteContratoComprador(id: number): Promise<boolean> {
  const existing = await getContratoCompradorById(id);
  if (!existing) return false;
  await prisma.contratoComprador.delete({ where: { id } });
  return true;
}

// ─── ContratoVendedor CRUD ────────────────────────────────────────────────────

export async function getAllContratosVendedor(): Promise<ContratoVendedor[]> {
  const rows = await prisma.contratoVendedor.findMany({ orderBy: { id: 'desc' } });
  return rows.map((r) => ({
    ...r,
    equipos_por_senal: r.equipos_por_senal as EquipoPorSenal[] | null,
  }));
}

export async function getContratoVendedorById(id: number): Promise<ContratoVendedor | null> {
  const row = await prisma.contratoVendedor.findUnique({ where: { id } });
  if (!row) return null;
  return { ...row, equipos_por_senal: row.equipos_por_senal as EquipoPorSenal[] | null };
}

export async function createContratoVendedor(data: CreateContratoVendedorData): Promise<ContratoVendedor> {
  const row = await prisma.contratoVendedor.create({
    data: {
      nombre_empresa: data.nombre_empresa,
      documentacion_empresa: data.documentacion_empresa ?? null,
      ejecutivo_cargo: data.ejecutivo_cargo ?? null,
      mail_comercial_cliente: data.mail_comercial_cliente ?? null,
      telefono_comercial_cliente: data.telefono_comercial_cliente ?? null,
      mail_tecnico_cliente: data.mail_tecnico_cliente ?? null,
      telefono_tecnico_cliente: data.telefono_tecnico_cliente ?? null,
      vigencia_desde: data.vigencia_desde ?? null,
      vigencia_hasta: data.vigencia_hasta ?? null,
      precio_tipo: data.precio_tipo ?? null,
      precio_valor: data.precio_valor ?? null,
      grilla: data.grilla ?? null,
      subs_minimo_garantizado: data.subs_minimo_garantizado ?? null,
      subs_reportados_senales: data.subs_reportados_senales ?? null,
      plazas_incluidas_contrato: data.plazas_incluidas_contrato ?? null,
      plazas_reportadas_senales: data.plazas_reportadas_senales ?? null,
      condiciones_pago: data.condiciones_pago ?? null,
      tnb_aplicada: data.tnb_aplicada ?? null,
      forma_recepcion_entrega: data.forma_recepcion_entrega ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      equipos_por_senal: (data.equipos_por_senal ?? undefined) as any,
      condiciones_entrega_equipamiento: data.condiciones_entrega_equipamiento ?? null,
      created_by: data.created_by ?? null,
      updated_by: data.updated_by ?? null,
    },
  });
  return { ...row, equipos_por_senal: row.equipos_por_senal as EquipoPorSenal[] | null };
}

export async function updateContratoVendedor(
  id: number,
  data: UpdateContratoVendedorData,
): Promise<ContratoVendedor | null> {
  const existing = await getContratoVendedorById(id);
  if (!existing) return null;
  const row = await prisma.contratoVendedor.update({
    where: { id },
    data: {
      nombre_empresa: data.nombre_empresa ?? undefined,
      documentacion_empresa: data.documentacion_empresa,
      ejecutivo_cargo: data.ejecutivo_cargo,
      mail_comercial_cliente: data.mail_comercial_cliente,
      telefono_comercial_cliente: data.telefono_comercial_cliente,
      mail_tecnico_cliente: data.mail_tecnico_cliente,
      telefono_tecnico_cliente: data.telefono_tecnico_cliente,
      vigencia_desde: data.vigencia_desde,
      vigencia_hasta: data.vigencia_hasta,
      precio_tipo: data.precio_tipo,
      precio_valor: data.precio_valor,
      grilla: data.grilla,
      subs_minimo_garantizado: data.subs_minimo_garantizado,
      subs_reportados_senales: data.subs_reportados_senales,
      plazas_incluidas_contrato: data.plazas_incluidas_contrato,
      plazas_reportadas_senales: data.plazas_reportadas_senales,
      condiciones_pago: data.condiciones_pago,
      tnb_aplicada: data.tnb_aplicada,
      forma_recepcion_entrega: data.forma_recepcion_entrega,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      equipos_por_senal: data.equipos_por_senal === undefined ? undefined : ((data.equipos_por_senal ?? undefined) as any),
      condiciones_entrega_equipamiento: data.condiciones_entrega_equipamiento,
      activa: data.activa,
      updated_by: data.updated_by,
    },
  });
  return { ...row, equipos_por_senal: row.equipos_por_senal as EquipoPorSenal[] | null };
}

export async function softDeleteContratoVendedor(id: number): Promise<boolean> {
  const result = await prisma.contratoVendedor.updateMany({
    where: { id },
    data: { activa: false },
  });
  return result.count > 0;
}

export async function deleteContratoVendedor(id: number): Promise<boolean> {
  const existing = await getContratoVendedorById(id);
  if (!existing) return false;
  await prisma.contratoVendedor.delete({ where: { id } });
  return true;
}

// ─── SaltoImporte ─────────────────────────────────────────────────────────────

export async function getAllSaltosImporte(): Promise<SaltoImporte[]> {
  return prisma.saltoImporte.findMany({ orderBy: { fecha_efectiva: 'asc' } }) as Promise<SaltoImporte[]>;
}

export async function getSaltosForContratoComprador(contratoId: number): Promise<SaltoImporte[]> {
  return prisma.saltoImporte.findMany({
    where: { contrato_comprador_id: contratoId },
    orderBy: { fecha_efectiva: 'asc' },
  }) as Promise<SaltoImporte[]>;
}

export async function getSaltosForContratoVendedor(contratoId: number): Promise<SaltoImporte[]> {
  return prisma.saltoImporte.findMany({
    where: { contrato_vendedor_id: contratoId },
    orderBy: { fecha_efectiva: 'asc' },
  }) as Promise<SaltoImporte[]>;
}

export async function getAlarmasActivas(): Promise<SaltoImporte[]> {
  const todayMs = new Date(new Date().toISOString().split('T')[0]).getTime();
  const candidates = (await prisma.saltoImporte.findMany({
    where: { activa: true, notificado_at: null },
    orderBy: { fecha_efectiva: 'asc' },
  })) as SaltoImporte[];
  return candidates.filter((s) => {
    const efectivaMs = new Date(s.fecha_efectiva).getTime();
    const desde = efectivaMs - s.dias_aviso_previo * 86400000;
    const hasta = efectivaMs + 7 * 86400000;
    return todayMs >= desde && todayMs <= hasta;
  });
}

export async function createSaltoImporte(data: CreateSaltoImporteData): Promise<SaltoImporte> {
  return prisma.saltoImporte.create({
    data: {
      contrato_comprador_id: data.contrato_comprador_id ?? null,
      contrato_vendedor_id: data.contrato_vendedor_id ?? null,
      descripcion: data.descripcion,
      fecha_efectiva: data.fecha_efectiva,
      dias_aviso_previo: data.dias_aviso_previo ?? 30,
      nuevo_precio: data.nuevo_precio ?? null,
      created_by: data.created_by ?? null,
      updated_by: data.updated_by ?? null,
    },
  }) as Promise<SaltoImporte>;
}

export async function marcarSaltoNotificado(id: number): Promise<SaltoImporte | null> {
  const existing = await prisma.saltoImporte.findUnique({ where: { id } });
  if (!existing) return null;
  return prisma.saltoImporte.update({
    where: { id },
    data: { notificado_at: new Date() },
  }) as Promise<SaltoImporte>;
}

export async function updateSaltoImporte(
  id: number,
  data: Partial<CreateSaltoImporteData> & { activa?: boolean; updated_by?: string | null },
): Promise<SaltoImporte | null> {
  const existing = await prisma.saltoImporte.findUnique({ where: { id } });
  if (!existing) return null;
  return prisma.saltoImporte.update({
    where: { id },
    data: {
      descripcion: data.descripcion,
      fecha_efectiva: data.fecha_efectiva,
      dias_aviso_previo: data.dias_aviso_previo,
      nuevo_precio: data.nuevo_precio,
      activa: data.activa,
      updated_by: data.updated_by,
    },
  }) as Promise<SaltoImporte>;
}

export async function deleteSaltoImporte(id: number): Promise<boolean> {
  const existing = await prisma.saltoImporte.findUnique({ where: { id } });
  if (!existing) return false;
  await prisma.saltoImporte.delete({ where: { id } });
  return true;
}

// ─── ArchivoContrato ──────────────────────────────────────────────────────────

export async function getArchivosForContratoComprador(contratoId: number): Promise<ArchivoContrato[]> {
  return prisma.archivoContrato.findMany({
    where: { contrato_comprador_id: contratoId },
    orderBy: { created_at: 'asc' },
  }) as Promise<ArchivoContrato[]>;
}

export async function getArchivosForContratoVendedor(contratoId: number): Promise<ArchivoContrato[]> {
  return prisma.archivoContrato.findMany({
    where: { contrato_vendedor_id: contratoId },
    orderBy: { created_at: 'asc' },
  }) as Promise<ArchivoContrato[]>;
}

export async function getArchivoById(id: number): Promise<ArchivoContrato | null> {
  return prisma.archivoContrato.findUnique({ where: { id } }) as Promise<ArchivoContrato | null>;
}

export async function createArchivoContrato(data: {
  contrato_comprador_id?: number | null;
  contrato_vendedor_id?: number | null;
  nombre_original: string;
  nombre_archivo: string;
  tipo_mime?: string | null;
  tamano?: number | null;
  created_by?: string | null;
}): Promise<ArchivoContrato> {
  return prisma.archivoContrato.create({
    data: {
      contrato_comprador_id: data.contrato_comprador_id ?? null,
      contrato_vendedor_id: data.contrato_vendedor_id ?? null,
      nombre_original: data.nombre_original,
      nombre_archivo: data.nombre_archivo,
      tipo_mime: data.tipo_mime ?? null,
      tamano: data.tamano ?? null,
      created_by: data.created_by ?? null,
    },
  }) as Promise<ArchivoContrato>;
}

export async function deleteArchivoById(id: number): Promise<boolean> {
  const existing = await getArchivoById(id);
  if (!existing) return false;
  await prisma.archivoContrato.delete({ where: { id } });
  return true;
}

// ─── Logo ─────────────────────────────────────────────────────────────────────

export async function setLogoComprador(id: number, nombreArchivo: string | null): Promise<void> {
  await prisma.contratoComprador.update({ where: { id }, data: { logo_nombre_archivo: nombreArchivo } });
}

export async function setLogoVendedor(id: number, nombreArchivo: string | null): Promise<void> {
  await prisma.contratoVendedor.update({ where: { id }, data: { logo_nombre_archivo: nombreArchivo } });
}
