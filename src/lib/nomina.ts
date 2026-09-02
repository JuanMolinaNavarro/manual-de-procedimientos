/**
 * Nómina — capa de datos (Prisma) y operaciones de negocio. Todo se escopea
 * por organigrama (empresa/ubicación). Los empleados son las fichas del
 * organigrama: nombre, rol, área y foto se leen de ahí; los datos de nómina
 * viven en las tablas Nomina*.
 *
 * Solo servidor. El cliente importa de acá únicamente tipos (`import type`).
 */

import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import {
  DEFAULT_BONOS,
  DEFAULT_CONCEPTOS,
  DEFAULT_MAESTRO,
  DEFAULT_NOVEDAD,
  DEFAULT_PARAMS,
  METRICAS,
  PARAM_KEYS,
  PIN_RE,
  mergeEmpresa,
  mergeParams,
  type Bono,
  type Concepto,
  type Empresa,
  type Maestro,
  type Metrica,
  type Novedad,
  type NovedadNumKey,
  type Params,
} from './nomina-datos';
import {
  contribTotalPct,
  descValorBono,
  liquidarEmpleado,
  maestroSnapshot,
  pasosTablero,
  periodosRacha,
  rankingBono,
  reciboMeta,
  reciboPayload,
  totalesLiquidacion,
  type EmpleadoNomina,
  type LiqAnterior,
  type Liquidacion,
  type MaestroSnapshot,
  type PasosTablero,
  type RankingRow,
  type ReciboMeta,
} from './nomina-calc';
import { GENESIS, chainHash, pinHash, reciboHash, verificarCadena } from './nomina-hash';

export class NominaError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'NominaError';
    this.status = status;
  }
}

// ─── Tipos que viajan a la UI ────────────────────────────────────────────────

export interface Config { params: Params; empresa: Empresa }

export interface MaestroRow { empleado: EmpleadoNomina; maestro: Maestro }

export interface NovedadRow { empleado: EmpleadoNomina; novedad: Novedad }

export interface ConstanciaView {
  id: number;
  periodo: string;
  empleadoId: number;
  hash: string;
  prevHash: string;
  chainHash: string;
  fecha: string;
  conformidad: string;
  observaciones: string;
  canal: string;
  firmante: { empId: number; nombre: string; cuil: string };
  dispositivo: string;
  leido: boolean;
}

export interface AdhesionView {
  empleadoId: number;
  fecha: string;
  modo: string;
  cuil: string;
  pinCambiado: string | null;
  acta: { nombreOriginal: string; tamano: number | null; subidaEn: string | null } | null;
}

/** Liquidación como la ve la UI: con foto, hash y estado de firma (si está cerrada). */
export interface LiquidacionView extends Liquidacion {
  foto_archivo: string | null;
  cuil: string;
  hash: string | null;
  constancia: ConstanciaView | null;
  adherido: boolean;
}

export interface LiquidacionData {
  periodo: string;
  cerrado: boolean;
  fechaCierre: string | null;
  liquidaciones: LiquidacionView[];
  totales: ReturnType<typeof totalesLiquidacion>;
}

export interface EstadoPeriodo {
  total: number;
  incluidos: number;
  conBasico: number;
  cerrado: boolean;
  fechaCierre: string | null;
  firmados: number;
  enCierre: number;
}

export interface HistoricoRow {
  periodo: string;
  fechaCierre: string;
  empleados: number;
  firmados: number;
  neto: number;
  costo: number;
}

export interface BonoCardData {
  bono: Bono;
  poolVacio: boolean;
  ganador: { emp: EmpleadoNomina; valor: number; desc: string; racha: RankingRow['racha'] } | null;
  segundo: { emp: EmpleadoNomina; valor: number } | null;
  otorgado: { empleadoId: number; nombre: string; monto: number; fecha: string } | null;
}

export interface MedalleroRow { emp: EmpleadoNomina; n: number; ultimo: string }

export interface TableroData {
  periodo: string;
  cerrado: boolean;
  fechaCierre: string | null;
  stats: {
    enNomina: number; totalEmpleados: number; conBasico: number; netos: number; costo: number;
    contribPct: number; art: number; errores: number; avisos: number; novCount: number;
  };
  pasos: PasosTablero;
  bonos: BonoCardData[];
  medallero: MedalleroRow[];
}

export interface AdhesionRow {
  empleado: EmpleadoNomina;
  cuil: string;
  adhesion: AdhesionView | null;
}

export interface ReciboRow {
  empleado: EmpleadoNomina;
  liquidacionId: number;
  neto: number;
  adherido: boolean;
  constancia: ConstanciaView | null;
  /** null = sin constancia; false = el hash firmado ya no coincide con el cierre. */
  hashOk: boolean | null;
}

export interface PeriodoRecibos {
  periodo: string;
  fechaCierre: string;
  firmados: number;
  rows: ReciboRow[];
}

export interface RecibosData {
  empresaOk: boolean;
  cadena: { total: number; rotos: number };
  adhesiones: AdhesionRow[];
  periodos: PeriodoRecibos[];
}

export interface ReciboVista {
  periodo: string;
  cerrado: boolean;
  fechaCierre: string | null;
  liquidacion: Liquidacion;
  meta: ReciboMeta;
  hash: string | null;
  constancia: ConstanciaView | null;
  adhesion: AdhesionView | null;
  foto_archivo: string | null;
}

export interface ReciboDeEmpleado {
  liquidacionId: number;
  organigramaId: number;
  organigramaNombre: string;
  periodo: string;
  fechaCierre: string;
  neto: number;
  constancia: { conformidad: string; fecha: string } | null;
}

export interface ActaDatos {
  empresa: { razonSocial: string; cuit: string; domicilio: string };
  trabajador: { id: number; nombre: string; cuil: string; categoria: string };
  organigramaId: number;
}

// ─── Helpers internos ────────────────────────────────────────────────────────

type EmpleadoRow = { id: number; nombre: string; rol: string; area: string; estado: string; foto_archivo: string | null };
const SELECT_EMPLEADO = { id: true, nombre: true, rol: true, area: true, estado: true, foto_archivo: true } as const;

function toEmpleado(e: EmpleadoRow): EmpleadoNomina {
  return { id: e.id, nombre: e.nombre, rol: e.rol, area: e.area, estado: e.estado, foto_archivo: e.foto_archivo };
}

type NominaEmpleadoRow = {
  cuil: string; fecha_ingreso: string; basico: number; categoria: string; convenio: string; cct: string;
  afiliado: boolean; obra_social: string; cbu: string; incluir: boolean;
};

function toMaestro(n: NominaEmpleadoRow | null, estado: string): Maestro {
  if (!n) return { ...DEFAULT_MAESTRO, incluir: estado === 'active' };
  return {
    cuil: n.cuil, fechaIngreso: n.fecha_ingreso, basico: n.basico, categoria: n.categoria, convenio: n.convenio,
    cct: n.cct, afiliado: n.afiliado, obraSocial: n.obra_social, cbu: n.cbu, incluir: n.incluir,
  };
}

type NovedadRowDb = {
  he50: number; he100: number; faltas_inj: number; dias_sin_goce: number; dias_vacaciones: number; comisiones: number;
  premios: number; sac: number; asig_familiares: number; ganancias: number; adelantos: number; embargos: number; notas: string;
};

function toNovedad(n: NovedadRowDb | null | undefined): Novedad {
  if (!n) return { ...DEFAULT_NOVEDAD };
  return {
    he50: n.he50, he100: n.he100, faltasInj: n.faltas_inj, diasSinGoce: n.dias_sin_goce, diasVacaciones: n.dias_vacaciones,
    comisiones: n.comisiones, premios: n.premios, sac: n.sac, asigFamiliares: n.asig_familiares, ganancias: n.ganancias,
    adelantos: n.adelantos, embargos: n.embargos, notas: n.notas,
  };
}

const NOVEDAD_DB: Record<NovedadNumKey, keyof Omit<NovedadRowDb, 'notas'>> = {
  he50: 'he50', he100: 'he100', faltasInj: 'faltas_inj', diasSinGoce: 'dias_sin_goce', diasVacaciones: 'dias_vacaciones',
  comisiones: 'comisiones', premios: 'premios', sac: 'sac', asigFamiliares: 'asig_familiares', ganancias: 'ganancias',
  adelantos: 'adelantos', embargos: 'embargos',
};

type ConstanciaDb = {
  id: number; periodo: string; empleado_id: number; hash: string; prev_hash: string; chain_hash: string; fecha: string;
  conformidad: string; observaciones: string; canal: string; firmante: Prisma.JsonValue; dispositivo: string; leido: boolean;
};

function toConstancia(c: ConstanciaDb): ConstanciaView {
  const f = (c.firmante && typeof c.firmante === 'object' ? c.firmante : {}) as Record<string, unknown>;
  return {
    id: c.id, periodo: c.periodo, empleadoId: c.empleado_id, hash: c.hash, prevHash: c.prev_hash, chainHash: c.chain_hash,
    fecha: c.fecha, conformidad: c.conformidad, observaciones: c.observaciones, canal: c.canal,
    firmante: { empId: Number(f.empId ?? c.empleado_id), nombre: String(f.nombre ?? ''), cuil: String(f.cuil ?? '') },
    dispositivo: c.dispositivo, leido: c.leido,
  };
}

type AdhesionDb = {
  empleado_id: number; fecha: string; modo: string; cuil: string; pin_cambiado: string | null;
  acta_archivo: string | null; acta_nombre_original: string | null; acta_tamano: number | null; acta_subida_en: Date | null;
};

function toAdhesion(a: AdhesionDb): AdhesionView {
  return {
    empleadoId: a.empleado_id, fecha: a.fecha, modo: a.modo, cuil: a.cuil, pinCambiado: a.pin_cambiado,
    acta: a.acta_archivo
      ? { nombreOriginal: a.acta_nombre_original ?? 'acta.pdf', tamano: a.acta_tamano, subidaEn: a.acta_subida_en?.toISOString() ?? null }
      : null,
  };
}

function toConcepto(c: { id: number; nombre: string; tipo: string; calculo: string; valor: number; activo: boolean; orden: number }): Concepto {
  return { id: c.id, nombre: c.nombre, tipo: c.tipo as Concepto['tipo'], calculo: c.calculo as Concepto['calculo'], valor: c.valor, activo: c.activo, orden: c.orden };
}

function toBono(b: { id: number; nombre: string; ambito: string; metrica: string; monto: number; activo: boolean; orden: number }): Bono {
  return { id: b.id, nombre: b.nombre, ambito: b.ambito, metrica: b.metrica as Metrica, monto: b.monto, activo: b.activo, orden: b.orden };
}

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined);
const bool = (v: unknown) => (typeof v === 'boolean' ? v : undefined);

async function assertOrganigrama(orgId: number): Promise<void> {
  const org = await prisma.organigrama.findUnique({ where: { id: orgId }, select: { id: true } });
  if (!org) throw new NominaError('Organigrama inexistente', 404);
}

/** Ficha del organigrama, verificando que pertenezca al organigrama pedido. */
async function empleadoDeOrg(orgId: number, empleadoId: number): Promise<EmpleadoNomina> {
  const e = await prisma.orgEmpleado.findUnique({ where: { id: empleadoId }, select: { ...SELECT_EMPLEADO, organigrama_id: true } });
  if (!e || e.organigrama_id !== orgId) throw new NominaError('El empleado no pertenece a este organigrama', 404);
  return toEmpleado(e);
}

// ─── Config (parámetros + empleador) ─────────────────────────────────────────

/**
 * Fila de configuración del organigrama; se crea sola la primera vez junto con
 * los conceptos y bonos por defecto del prototipo.
 */
async function ensureConfig(orgId: number) {
  const existente = await prisma.nominaConfig.findUnique({ where: { organigrama_id: orgId } });
  if (existente) return existente;
  await assertOrganigrama(orgId);
  try {
    return await prisma.$transaction(async (tx) => {
      const row = await tx.nominaConfig.create({ data: { organigrama_id: orgId, params: {}, empresa: {} } });
      await tx.nominaConcepto.createMany({ data: DEFAULT_CONCEPTOS.map((c) => ({ ...c, organigrama_id: orgId })) });
      await tx.nominaBono.createMany({ data: DEFAULT_BONOS.map((b) => ({ ...b, organigrama_id: orgId })) });
      return row;
    });
  } catch (e) {
    // Varias pantallas piden la config a la vez la primera vez: si otra request
    // ganó la carrera, la fila ya existe y se reutiliza.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const row = await prisma.nominaConfig.findUnique({ where: { organigrama_id: orgId } });
      if (row) return row;
    }
    throw e;
  }
}

export async function getConfig(orgId: number): Promise<Config> {
  const row = await ensureConfig(orgId);
  return { params: mergeParams(row.params), empresa: mergeEmpresa(row.empresa) };
}

export async function updateConfig(
  orgId: number,
  data: { params?: unknown; empresa?: unknown; resetParams?: boolean },
  username: string | null,
): Promise<Config> {
  const actual = await getConfig(orgId);
  let params = actual.params;
  if (data.resetParams) params = { ...DEFAULT_PARAMS };
  else if (data.params && typeof data.params === 'object') {
    const src = data.params as Record<string, unknown>;
    params = { ...actual.params };
    for (const k of PARAM_KEYS) {
      const v = num(src[k]);
      if (v !== undefined) params[k] = v;
    }
  }
  let empresa = actual.empresa;
  if (data.empresa && typeof data.empresa === 'object') {
    const src = data.empresa as Record<string, unknown>;
    empresa = { ...actual.empresa };
    for (const k of Object.keys(empresa) as (keyof Empresa)[]) {
      const v = str(src[k]);
      if (v !== undefined) empresa[k] = v;
    }
  }
  const row = await prisma.nominaConfig.update({
    where: { organigrama_id: orgId },
    data: { params: params as unknown as Prisma.InputJsonObject, empresa: empresa as unknown as Prisma.InputJsonObject, updated_by: username },
  });
  return { params: mergeParams(row.params), empresa: mergeEmpresa(row.empresa) };
}

// ─── Conceptos ───────────────────────────────────────────────────────────────

export async function getConceptos(orgId: number): Promise<Concepto[]> {
  await ensureConfig(orgId);
  const rows = await prisma.nominaConcepto.findMany({ where: { organigrama_id: orgId }, orderBy: [{ orden: 'asc' }, { id: 'asc' }] });
  return rows.map(toConcepto);
}

export async function addConcepto(orgId: number): Promise<Concepto> {
  await ensureConfig(orgId);
  const n = await prisma.nominaConcepto.count({ where: { organigrama_id: orgId } });
  const row = await prisma.nominaConcepto.create({
    data: { organigrama_id: orgId, nombre: 'Nuevo concepto', tipo: 'rem', calculo: 'monto', valor: 0, activo: false, orden: n },
  });
  return toConcepto(row);
}

export async function updateConcepto(orgId: number, id: number, data: Partial<Concepto>): Promise<Concepto> {
  const c = await prisma.nominaConcepto.findUnique({ where: { id } });
  if (!c || c.organigrama_id !== orgId) throw new NominaError('Concepto inexistente', 404);
  const tipo = str(data.tipo), calculo = str(data.calculo);
  if (tipo !== undefined && !['rem', 'norem', 'ded'].includes(tipo)) throw new NominaError('Tipo de concepto inválido');
  if (calculo !== undefined && !['monto', 'pct_basico', 'pct_rem'].includes(calculo)) throw new NominaError('Cálculo de concepto inválido');
  const row = await prisma.nominaConcepto.update({
    where: { id },
    data: {
      ...(str(data.nombre) !== undefined ? { nombre: str(data.nombre) } : {}),
      ...(tipo !== undefined ? { tipo } : {}),
      ...(calculo !== undefined ? { calculo } : {}),
      ...(num(data.valor) !== undefined ? { valor: num(data.valor) } : {}),
      ...(bool(data.activo) !== undefined ? { activo: bool(data.activo) } : {}),
    },
  });
  return toConcepto(row);
}

export async function deleteConcepto(orgId: number, id: number): Promise<void> {
  const c = await prisma.nominaConcepto.findUnique({ where: { id } });
  if (!c || c.organigrama_id !== orgId) throw new NominaError('Concepto inexistente', 404);
  await prisma.nominaConcepto.delete({ where: { id } });
}

// ─── Bonos ───────────────────────────────────────────────────────────────────

export async function getBonos(orgId: number): Promise<{ bonos: Bono[]; areas: string[] }> {
  await ensureConfig(orgId);
  const rows = await prisma.nominaBono.findMany({ where: { organigrama_id: orgId }, orderBy: [{ orden: 'asc' }, { id: 'asc' }] });
  return { bonos: rows.map(toBono), areas: await areasDisponibles(orgId) };
}

/** Áreas del organigrama ∪ áreas de sus empleados ∪ ámbitos ya usados por bonos. */
export async function areasDisponibles(orgId: number): Promise<string[]> {
  const [areas, emps, bonos] = await Promise.all([
    prisma.orgArea.findMany({ where: { organigrama_id: orgId }, select: { nombre: true } }),
    prisma.orgEmpleado.findMany({ where: { organigrama_id: orgId }, select: { area: true } }),
    prisma.nominaBono.findMany({ where: { organigrama_id: orgId }, select: { ambito: true } }),
  ]);
  const set = new Set<string>();
  areas.forEach((a) => a.nombre && set.add(a.nombre));
  emps.forEach((e) => e.area && set.add(e.area));
  bonos.forEach((b) => b.ambito && b.ambito !== 'empresa' && set.add(b.ambito));
  return [...set].sort((a, b) => a.localeCompare(b));
}

export async function addBono(orgId: number): Promise<Bono> {
  await ensureConfig(orgId);
  const n = await prisma.nominaBono.count({ where: { organigrama_id: orgId } });
  const row = await prisma.nominaBono.create({
    data: { organigrama_id: orgId, nombre: 'Nuevo bono', ambito: 'empresa', metrica: 'horas_extra', monto: 0, activo: true, orden: n },
  });
  return toBono(row);
}

export async function updateBono(orgId: number, id: number, data: Partial<Bono>): Promise<Bono> {
  const b = await prisma.nominaBono.findUnique({ where: { id } });
  if (!b || b.organigrama_id !== orgId) throw new NominaError('Bono inexistente', 404);
  const metrica = str(data.metrica);
  if (metrica !== undefined && !(METRICAS as string[]).includes(metrica)) throw new NominaError('Métrica inválida');
  const row = await prisma.nominaBono.update({
    where: { id },
    data: {
      ...(str(data.nombre) !== undefined ? { nombre: str(data.nombre) } : {}),
      ...(str(data.ambito) !== undefined ? { ambito: str(data.ambito) || 'empresa' } : {}),
      ...(metrica !== undefined ? { metrica } : {}),
      ...(num(data.monto) !== undefined ? { monto: Math.max(0, num(data.monto)!) } : {}),
      ...(bool(data.activo) !== undefined ? { activo: bool(data.activo) } : {}),
    },
  });
  return toBono(row);
}

export async function deleteBono(orgId: number, id: number): Promise<void> {
  const b = await prisma.nominaBono.findUnique({ where: { id } });
  if (!b || b.organigrama_id !== orgId) throw new NominaError('Bono inexistente', 404);
  await prisma.nominaBono.delete({ where: { id } }); // los otorgados quedan (bono_id → null)
}

// ─── Maestro ─────────────────────────────────────────────────────────────────

export async function getMaestro(orgId: number): Promise<MaestroRow[]> {
  await ensureConfig(orgId);
  const rows = await prisma.orgEmpleado.findMany({
    where: { organigrama_id: orgId },
    select: { ...SELECT_EMPLEADO, nomina: true },
    orderBy: { id: 'asc' },
  });
  return rows.map((r) => ({ empleado: toEmpleado(r), maestro: toMaestro(r.nomina, r.estado) }));
}

/** Empleados del organigrama marcados para liquidar. */
async function empleadosIncluidos(orgId: number): Promise<MaestroRow[]> {
  return (await getMaestro(orgId)).filter((r) => r.maestro.incluir);
}

export async function updateMaestro(orgId: number, empleadoId: number, data: Partial<Maestro>, username: string | null): Promise<MaestroRow> {
  const empleado = await empleadoDeOrg(orgId, empleadoId);
  const actual = toMaestro(await prisma.nominaEmpleado.findUnique({ where: { empleado_id: empleadoId } }), empleado.estado);
  const next: Maestro = {
    cuil: str(data.cuil, 20) ?? actual.cuil,
    fechaIngreso: str(data.fechaIngreso, 10) ?? actual.fechaIngreso,
    basico: num(data.basico) !== undefined ? Math.max(0, num(data.basico)!) : actual.basico,
    categoria: str(data.categoria) ?? actual.categoria,
    convenio: str(data.convenio) ?? actual.convenio,
    cct: str(data.cct, 60) ?? actual.cct,
    afiliado: bool(data.afiliado) ?? actual.afiliado,
    obraSocial: str(data.obraSocial) ?? actual.obraSocial,
    cbu: str(data.cbu, 30) ?? actual.cbu,
    incluir: bool(data.incluir) ?? actual.incluir,
  };
  if (next.fechaIngreso && !/^\d{4}-\d{2}-\d{2}$/.test(next.fechaIngreso)) throw new NominaError('Fecha de ingreso inválida (yyyy-mm-dd)');
  const db = {
    cuil: next.cuil, fecha_ingreso: next.fechaIngreso, basico: next.basico, categoria: next.categoria, convenio: next.convenio,
    cct: next.cct, afiliado: next.afiliado, obra_social: next.obraSocial, cbu: next.cbu, incluir: next.incluir, updated_by: username,
  };
  await prisma.nominaEmpleado.upsert({ where: { empleado_id: empleadoId }, update: db, create: { empleado_id: empleadoId, ...db } });
  return { empleado, maestro: next };
}

// ─── Novedades ───────────────────────────────────────────────────────────────

async function getCierre(orgId: number, periodo: string) {
  return prisma.nominaCierre.findUnique({ where: { organigrama_id_periodo: { organigrama_id: orgId, periodo } } });
}

async function novedadesDe(empleadoIds: number[], periodos: string[]): Promise<Record<string, Record<number, Novedad>>> {
  if (!empleadoIds.length || !periodos.length) return {};
  const rows = await prisma.nominaNovedad.findMany({ where: { empleado_id: { in: empleadoIds }, periodo: { in: periodos } } });
  const out: Record<string, Record<number, Novedad>> = {};
  for (const r of rows) {
    (out[r.periodo] ??= {})[r.empleado_id] = toNovedad(r);
  }
  return out;
}

export async function getNovedades(orgId: number, periodo: string): Promise<{ cerrado: boolean; rows: NovedadRow[] }> {
  const [incluidos, cierre] = await Promise.all([empleadosIncluidos(orgId), getCierre(orgId, periodo)]);
  const nov = await novedadesDe(incluidos.map((r) => r.empleado.id), [periodo]);
  return {
    cerrado: !!cierre,
    rows: incluidos.map((r) => ({ empleado: r.empleado, novedad: nov[periodo]?.[r.empleado.id] ?? { ...DEFAULT_NOVEDAD } })),
  };
}

export async function updateNovedad(orgId: number, empleadoId: number, periodo: string, data: Partial<Novedad>, username: string | null): Promise<Novedad> {
  await empleadoDeOrg(orgId, empleadoId);
  if (await getCierre(orgId, periodo)) throw new NominaError('Período cerrado: no se puede modificar', 409);
  const patch: Record<string, number | string | null> = { updated_by: username };
  for (const k of Object.keys(NOVEDAD_DB) as NovedadNumKey[]) {
    const v = num(data[k]);
    if (v !== undefined) patch[NOVEDAD_DB[k]] = Math.max(0, v);
  }
  const notas = str(data.notas, 500);
  if (notas !== undefined) patch.notas = notas;
  const row = await prisma.nominaNovedad.upsert({
    where: { empleado_id_periodo: { empleado_id: empleadoId, periodo } },
    update: patch,
    create: { empleado_id: empleadoId, periodo, ...patch },
  });
  return toNovedad(row);
}

// ─── Liquidación ─────────────────────────────────────────────────────────────

async function ultimoCerradoAnterior(orgId: number, periodo: string): Promise<LiqAnterior | null> {
  const prev = await prisma.nominaCierre.findFirst({
    where: { organigrama_id: orgId, periodo: { lt: periodo } },
    orderBy: { periodo: 'desc' },
    include: { liquidaciones: { select: { empleado_id: true, neto: true } } },
  });
  if (!prev) return null;
  return { periodo: prev.periodo, netos: Object.fromEntries(prev.liquidaciones.map((l) => [l.empleado_id, l.neto])) };
}

interface ContextoLiq {
  config: Config;
  conceptos: Concepto[];
  incluidos: MaestroRow[];
  novedades: Record<number, Novedad>;
  liqAnterior: LiqAnterior | null;
}

async function contextoLiquidacion(orgId: number, periodo: string): Promise<ContextoLiq> {
  const [config, conceptos, incluidos, liqAnterior] = await Promise.all([
    getConfig(orgId), getConceptos(orgId), empleadosIncluidos(orgId), ultimoCerradoAnterior(orgId, periodo),
  ]);
  const nov = await novedadesDe(incluidos.map((r) => r.empleado.id), [periodo]);
  return { config, conceptos: conceptos.filter((c) => c.activo), incluidos, novedades: nov[periodo] ?? {}, liqAnterior };
}

function liquidarContexto(ctx: ContextoLiq, periodo: string): Liquidacion[] {
  return ctx.incluidos.map((r) => liquidarEmpleado({
    empleado: r.empleado, maestro: r.maestro, novedad: ctx.novedades[r.empleado.id] ?? { ...DEFAULT_NOVEDAD },
    params: ctx.config.params, conceptos: ctx.conceptos, periodo, liqAnterior: ctx.liqAnterior,
  }));
}

/** Pre-liquidación en vivo del período (sin cerrar). */
export async function liquidarPeriodo(orgId: number, periodo: string): Promise<Liquidacion[]> {
  return liquidarContexto(await contextoLiquidacion(orgId, periodo), periodo);
}

async function constanciasDe(orgId: number, periodo: string): Promise<Record<number, ConstanciaView>> {
  const rows = await prisma.nominaConstancia.findMany({ where: { organigrama_id: orgId, periodo } });
  return Object.fromEntries(rows.map((c) => [c.empleado_id, toConstancia(c)]));
}

async function adhesionesDe(orgId: number): Promise<Record<number, AdhesionView>> {
  const rows = await prisma.nominaAdhesion.findMany({ where: { organigrama_id: orgId } });
  return Object.fromEntries(rows.map((a) => [a.empleado_id, toAdhesion(a)]));
}

type LiquidacionDbRow = { id: number; empleado_id: number; liquidacion: Prisma.JsonValue; hash: string; maestro_snapshot: Prisma.JsonValue };

function liqDesdeSnapshot(row: LiquidacionDbRow): Liquidacion {
  return row.liquidacion as unknown as Liquidacion;
}

export async function getLiquidacion(orgId: number, periodo: string): Promise<LiquidacionData> {
  const cierre = await prisma.nominaCierre.findUnique({
    where: { organigrama_id_periodo: { organigrama_id: orgId, periodo } },
    include: { liquidaciones: { include: { empleado: { select: SELECT_EMPLEADO } }, orderBy: { id: 'asc' } } },
  });
  if (cierre) {
    const [constancias, adhesiones] = await Promise.all([constanciasDe(orgId, periodo), adhesionesDe(orgId)]);
    const liquidaciones: LiquidacionView[] = cierre.liquidaciones.map((r) => ({
      ...liqDesdeSnapshot(r),
      foto_archivo: r.empleado.foto_archivo,
      cuil: (r.maestro_snapshot as unknown as MaestroSnapshot).cuil ?? '',
      hash: r.hash,
      constancia: constancias[r.empleado_id] ?? null,
      adherido: !!adhesiones[r.empleado_id],
    }));
    return { periodo, cerrado: true, fechaCierre: cierre.fecha_cierre, liquidaciones, totales: totalesLiquidacion(liquidaciones) };
  }
  const ctx = await contextoLiquidacion(orgId, periodo);
  const porEmp = Object.fromEntries(ctx.incluidos.map((r) => [r.empleado.id, r]));
  const liquidaciones: LiquidacionView[] = liquidarContexto(ctx, periodo).map((l) => ({
    ...l, foto_archivo: porEmp[l.empId]?.empleado.foto_archivo ?? null, cuil: porEmp[l.empId]?.maestro.cuil ?? '',
    hash: null, constancia: null, adherido: false,
  }));
  return { periodo, cerrado: false, fechaCierre: null, liquidaciones, totales: totalesLiquidacion(liquidaciones) };
}

export async function cerrarPeriodo(orgId: number, periodo: string, username: string | null): Promise<{ periodo: string; fechaCierre: string; empleados: number; neto: number }> {
  if (await getCierre(orgId, periodo)) throw new NominaError('El período ya está cerrado', 409);
  const ctx = await contextoLiquidacion(orgId, periodo);
  const liqs = liquidarContexto(ctx, periodo);
  if (!liqs.length) throw new NominaError('Nada para cerrar: no hay empleados incluidos en el Maestro');
  const errores = liqs.flatMap((l) => l.flags.filter((f) => f.tipo === 'error').map((f) => `${l.nombre}: ${f.msg}`));
  if (errores.length) throw new NominaError('Hay errores que bloquean el cierre: ' + errores.join(' · '));

  const fechaCierre = new Date().toISOString();
  const maestroPorEmp = Object.fromEntries(ctx.incluidos.map((r) => [r.empleado.id, r.maestro]));
  try {
    await prisma.$transaction(async (tx) => {
      const cierre = await tx.nominaCierre.create({
        data: {
          organigrama_id: orgId, periodo, fecha_cierre: fechaCierre, created_by: username,
          params_snapshot: ctx.config.params as unknown as Prisma.InputJsonObject,
          empresa_snapshot: ctx.config.empresa as unknown as Prisma.InputJsonObject,
        },
      });
      for (const l of liqs) {
        const snap: MaestroSnapshot = maestroSnapshot(maestroPorEmp[l.empId]);
        const hash = reciboHash(reciboPayload(l, reciboMeta(l, ctx.config.empresa, snap, periodo), fechaCierre));
        await tx.nominaLiquidacion.create({
          data: {
            cierre_id: cierre.id, empleado_id: l.empId, nombre: l.nombre, rol: l.rol, area: l.dept,
            maestro_snapshot: snap as unknown as Prisma.InputJsonObject,
            liquidacion: l as unknown as Prisma.InputJsonObject,
            neto: l.neto, costo_empresa: l.costoEmpresa, hash,
          },
        });
      }
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new NominaError('El período ya está cerrado', 409);
    throw e;
  }
  return { periodo, fechaCierre, empleados: liqs.length, neto: liqs.reduce((s, l) => s + l.neto, 0) };
}

export async function reabrirPeriodo(orgId: number, periodo: string): Promise<{ firmasConservadas: number }> {
  const cierre = await getCierre(orgId, periodo);
  if (!cierre) throw new NominaError('El período no está cerrado', 404);
  const firmas = await prisma.nominaConstancia.count({ where: { organigrama_id: orgId, periodo } });
  await prisma.nominaCierre.delete({ where: { id: cierre.id } }); // cascade: liquidaciones; las constancias quedan
  return { firmasConservadas: firmas };
}

export async function getHistorico(orgId: number): Promise<HistoricoRow[]> {
  const cierres = await prisma.nominaCierre.findMany({
    where: { organigrama_id: orgId },
    orderBy: { periodo: 'desc' },
    include: { liquidaciones: { select: { neto: true, costo_empresa: true } } },
  });
  const firmados = await prisma.nominaConstancia.groupBy({ by: ['periodo'], where: { organigrama_id: orgId }, _count: { _all: true } });
  const firmadosPor = Object.fromEntries(firmados.map((f) => [f.periodo, f._count._all]));
  return cierres.map((c) => ({
    periodo: c.periodo, fechaCierre: c.fecha_cierre, empleados: c.liquidaciones.length,
    firmados: firmadosPor[c.periodo] ?? 0,
    neto: c.liquidaciones.reduce((s, l) => s + l.neto, 0),
    costo: c.liquidaciones.reduce((s, l) => s + l.costo_empresa, 0),
  }));
}

export async function getEstado(orgId: number, periodo: string): Promise<EstadoPeriodo> {
  const [maestro, cierre] = await Promise.all([
    getMaestro(orgId),
    prisma.nominaCierre.findUnique({ where: { organigrama_id_periodo: { organigrama_id: orgId, periodo } }, include: { _count: { select: { liquidaciones: true } } } }),
  ]);
  const incluidos = maestro.filter((r) => r.maestro.incluir);
  const firmados = cierre ? await prisma.nominaConstancia.count({ where: { organigrama_id: orgId, periodo } }) : 0;
  return {
    total: maestro.length, incluidos: incluidos.length, conBasico: incluidos.filter((r) => r.maestro.basico > 0).length,
    cerrado: !!cierre, fechaCierre: cierre?.fecha_cierre ?? null, firmados, enCierre: cierre?._count.liquidaciones ?? 0,
  };
}

// ─── Tablero ─────────────────────────────────────────────────────────────────

export async function getTablero(orgId: number, periodo: string): Promise<TableroData> {
  const [maestro, config, cierre, todosCierres] = await Promise.all([
    getMaestro(orgId), getConfig(orgId), getCierre(orgId, periodo),
    prisma.nominaCierre.findMany({ where: { organigrama_id: orgId }, select: { periodo: true } }),
  ]);
  const incluidos = maestro.filter((r) => r.maestro.incluir);
  const ids = incluidos.map((r) => r.empleado.id);
  const data = await getLiquidacion(orgId, periodo);
  const t = data.totales;
  const novCount = ids.length ? await prisma.nominaNovedad.count({ where: { periodo, empleado_id: { in: ids } } }) : 0;
  const maestroOk = incluidos.filter((r) => r.maestro.basico > 0).length;

  // Bonos: ranking con las novedades del período y la racha de los últimos cerrados.
  const periodos = periodosRacha(todosCierres.map((c) => c.periodo), periodo, !!cierre);
  const [bonos, novPorPeriodo, otorgados, todosOtorgados] = await Promise.all([
    prisma.nominaBono.findMany({ where: { organigrama_id: orgId, activo: true }, orderBy: [{ orden: 'asc' }, { id: 'asc' }] }),
    novedadesDe(ids, [...new Set([...periodos, periodo])]),
    prisma.nominaBonoOtorgado.findMany({ where: { organigrama_id: orgId, periodo } }),
    prisma.nominaBonoOtorgado.findMany({ where: { organigrama_id: orgId }, include: { empleado: { select: SELECT_EMPLEADO } }, orderBy: { id: 'asc' } }),
  ]);
  const empleadosIncl = incluidos.map((r) => r.empleado);
  const porId = Object.fromEntries(maestro.map((r) => [r.empleado.id, r.empleado]));
  const cards: BonoCardData[] = bonos.map((b) => {
    const bono = toBono(b);
    const rk = rankingBono(bono, empleadosIncl, novPorPeriodo, periodos, periodo);
    const ot = otorgados.find((o) => o.bono_id === b.id) ?? null;
    const win = rk.length && rk[0].valor > 0 ? rk[0] : null;
    const seg = rk.length > 1 && rk[1].valor > 0 ? rk[1] : null;
    return {
      bono,
      poolVacio: rk.length === 0,
      ganador: win ? { emp: win.emp, valor: win.valor, desc: descValorBono(bono.metrica, win.valor, periodo), racha: win.racha } : null,
      segundo: seg ? { emp: seg.emp, valor: seg.valor } : null,
      otorgado: ot ? { empleadoId: ot.empleado_id, nombre: porId[ot.empleado_id]?.nombre ?? '—', monto: ot.monto, fecha: ot.fecha } : null,
    };
  });
  const counts = new Map<number, MedalleroRow>();
  for (const o of todosOtorgados) {
    const cur = counts.get(o.empleado_id) ?? { emp: toEmpleado(o.empleado), n: 0, ultimo: '' };
    cur.n++; cur.ultimo = o.bono_nombre;
    counts.set(o.empleado_id, cur);
  }
  const medallero = [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 8);

  return {
    periodo, cerrado: !!cierre, fechaCierre: cierre?.fecha_cierre ?? null,
    stats: {
      enNomina: incluidos.length, totalEmpleados: maestro.length, conBasico: maestroOk, netos: t.neto, costo: t.costo,
      contribPct: contribTotalPct(config.params), art: config.params.art, errores: t.errores, avisos: t.avisos, novCount,
    },
    pasos: pasosTablero({ incluidos: incluidos.length, maestroOk, novCount, errores: t.errores, cerrado: !!cierre }),
    bonos: cards,
    medallero,
  };
}

export async function otorgarBono(orgId: number, bonoId: number, periodo: string, username: string | null): Promise<{ ganador: EmpleadoNomina; monto: number }> {
  const b = await prisma.nominaBono.findUnique({ where: { id: bonoId } });
  if (!b || b.organigrama_id !== orgId) throw new NominaError('Bono inexistente', 404);
  if (await getCierre(orgId, periodo)) throw new NominaError('Período cerrado: no se pueden otorgar bonos', 409);
  const existente = await prisma.nominaBonoOtorgado.findFirst({ where: { organigrama_id: orgId, periodo, bono_id: bonoId } });
  if (existente) throw new NominaError('Este bono ya fue otorgado en el período', 409);
  const [incluidos, cierres] = await Promise.all([empleadosIncluidos(orgId), prisma.nominaCierre.findMany({ where: { organigrama_id: orgId }, select: { periodo: true } })]);
  const periodos = periodosRacha(cierres.map((c) => c.periodo), periodo, false);
  const nov = await novedadesDe(incluidos.map((r) => r.empleado.id), [...new Set([...periodos, periodo])]);
  const rk = rankingBono(toBono(b), incluidos.map((r) => r.empleado), nov, periodos, periodo);
  if (!rk.length || rk[0].valor <= 0) throw new NominaError('Sin ganador definido este mes');
  const win = rk[0].emp;
  const monto = Math.max(0, b.monto);
  const hoy = new Date().toISOString().slice(0, 10);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.nominaBonoOtorgado.create({
        data: { organigrama_id: orgId, periodo, bono_id: b.id, bono_nombre: b.nombre, empleado_id: win.id, monto, fecha: hoy, created_by: username },
      });
      if (monto > 0) {
        const actual = await tx.nominaNovedad.findUnique({ where: { empleado_id_periodo: { empleado_id: win.id, periodo } } });
        const notas = (actual?.notas ? actual.notas + ' · ' : '') + 'Bono: ' + b.nombre;
        await tx.nominaNovedad.upsert({
          where: { empleado_id_periodo: { empleado_id: win.id, periodo } },
          update: { premios: (actual?.premios ?? 0) + monto, notas, updated_by: username },
          create: { empleado_id: win.id, periodo, premios: monto, notas, updated_by: username },
        });
      }
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new NominaError('Este bono ya fue otorgado en el período', 409);
    throw e;
  }
  return { ganador: win, monto };
}

// ─── Recibos: adhesión, firma y constancias ──────────────────────────────────

function validarPin(pin: unknown, pin2: unknown): string {
  const p1 = typeof pin === 'string' ? pin.trim() : '';
  const p2 = typeof pin2 === 'string' ? pin2.trim() : '';
  if (!PIN_RE.test(p1)) throw new NominaError('El PIN debe tener entre 4 y 8 dígitos');
  if (p1 !== p2) throw new NominaError('Los PIN no coinciden');
  return p1;
}

export async function adherir(orgId: number, empleadoId: number, modo: unknown, pin: unknown, pin2: unknown, username: string | null): Promise<AdhesionView> {
  const empleado = await empleadoDeOrg(orgId, empleadoId);
  const m = toMaestro(await prisma.nominaEmpleado.findUnique({ where: { empleado_id: empleadoId } }), empleado.estado);
  if (!m.cuil) throw new NominaError('Cargá el CUIL en el Maestro antes de adherir');
  const modoOk = modo === 'electronica' ? 'electronica' : 'papel';
  const p = validarPin(pin, pin2);
  if (await prisma.nominaAdhesion.findUnique({ where: { empleado_id: empleadoId } })) throw new NominaError('El trabajador ya está adherido', 409);
  const row = await prisma.nominaAdhesion.create({
    data: {
      empleado_id: empleadoId, organigrama_id: orgId, fecha: new Date().toISOString().slice(0, 10), modo: modoOk,
      cuil: m.cuil, pin_hash: pinHash(p, m.cuil), created_by: username,
    },
  });
  return toAdhesion(row);
}

export async function cambiarPin(orgId: number, empleadoId: number, pin: unknown, pin2: unknown): Promise<void> {
  const a = await prisma.nominaAdhesion.findUnique({ where: { empleado_id: empleadoId } });
  if (!a || a.organigrama_id !== orgId) throw new NominaError('El trabajador no está adherido', 404);
  const p = validarPin(pin, pin2);
  await prisma.nominaAdhesion.update({ where: { empleado_id: empleadoId }, data: { pin_hash: pinHash(p, a.cuil), pin_cambiado: new Date().toISOString() } });
}

/** Revoca la adhesión; devuelve el nombre del acta guardada (para borrar el archivo). */
export async function revocarAdhesion(orgId: number, empleadoId: number): Promise<{ actaArchivo: string | null }> {
  const a = await prisma.nominaAdhesion.findUnique({ where: { empleado_id: empleadoId } });
  if (!a || a.organigrama_id !== orgId) throw new NominaError('El trabajador no está adherido', 404);
  await prisma.nominaAdhesion.delete({ where: { empleado_id: empleadoId } }); // las constancias se conservan
  return { actaArchivo: a.acta_archivo };
}

export async function getAdhesion(orgId: number, empleadoId: number): Promise<{ view: AdhesionView; actaArchivo: string | null }> {
  const a = await prisma.nominaAdhesion.findUnique({ where: { empleado_id: empleadoId } });
  if (!a || a.organigrama_id !== orgId) throw new NominaError('El trabajador no está adherido', 404);
  return { view: toAdhesion(a), actaArchivo: a.acta_archivo };
}

/** Registra el acta escaneada; devuelve el archivo anterior (para borrarlo). */
export async function setActa(orgId: number, empleadoId: number, acta: { archivo: string; nombreOriginal: string; tamano: number }): Promise<{ anterior: string | null; view: AdhesionView }> {
  const a = await prisma.nominaAdhesion.findUnique({ where: { empleado_id: empleadoId } });
  if (!a || a.organigrama_id !== orgId) throw new NominaError('El trabajador no está adherido', 404);
  const row = await prisma.nominaAdhesion.update({
    where: { empleado_id: empleadoId },
    data: { acta_archivo: acta.archivo, acta_nombre_original: acta.nombreOriginal, acta_tamano: acta.tamano, acta_subida_en: new Date() },
  });
  return { anterior: a.acta_archivo, view: toAdhesion(row) };
}

export async function clearActa(orgId: number, empleadoId: number): Promise<{ anterior: string | null }> {
  const a = await prisma.nominaAdhesion.findUnique({ where: { empleado_id: empleadoId } });
  if (!a || a.organigrama_id !== orgId) throw new NominaError('El trabajador no está adherido', 404);
  await prisma.nominaAdhesion.update({
    where: { empleado_id: empleadoId },
    data: { acta_archivo: null, acta_nombre_original: null, acta_tamano: null, acta_subida_en: null },
  });
  return { anterior: a.acta_archivo };
}

export async function getActaDatos(orgId: number, empleadoId: number): Promise<ActaDatos> {
  const [empleado, config] = await Promise.all([empleadoDeOrg(orgId, empleadoId), getConfig(orgId)]);
  const m = toMaestro(await prisma.nominaEmpleado.findUnique({ where: { empleado_id: empleadoId } }), empleado.estado);
  return {
    empresa: { razonSocial: config.empresa.razonSocial, cuit: config.empresa.cuit, domicilio: config.empresa.domicilio },
    trabajador: { id: empleado.id, nombre: empleado.nombre, cuil: m.cuil, categoria: m.categoria },
    organigramaId: orgId,
  };
}

// Freno de fuerza bruta sobre el PIN (4–8 dígitos): 5 fallos → 60 s de espera.
const pinFallos = new Map<number, { n: number; hasta: number }>();
const PIN_MAX_FALLOS = 5, PIN_BLOQUEO_MS = 60_000;

function checkPinThrottle(empleadoId: number) {
  const f = pinFallos.get(empleadoId);
  if (f && f.n >= PIN_MAX_FALLOS && Date.now() < f.hasta) {
    throw new NominaError(`Demasiados intentos: esperá ${Math.ceil((f.hasta - Date.now()) / 1000)} s`, 429);
  }
}
function pinFallo(empleadoId: number) {
  const f = pinFallos.get(empleadoId) ?? { n: 0, hasta: 0 };
  f.n = Date.now() < f.hasta ? f.n + 1 : f.n >= PIN_MAX_FALLOS ? 1 : f.n + 1;
  if (f.n >= PIN_MAX_FALLOS) f.hasta = Date.now() + PIN_BLOQUEO_MS;
  pinFallos.set(empleadoId, f);
}

export interface FirmaInput {
  pin: unknown;
  conformidad: unknown;
  observaciones: unknown;
  leido: unknown;
  dispositivo: string;
}

/**
 * Firma en kiosco: verifica el PIN contra la adhesión y registra la constancia
 * encadenada con la anterior del organigrama. El lock advisory serializa las
 * firmas concurrentes para que la cadena nunca se bifurque.
 */
export async function firmarKiosco(orgId: number, periodo: string, empleadoId: number, input: FirmaInput): Promise<ConstanciaView> {
  const cierre = await prisma.nominaCierre.findUnique({
    where: { organigrama_id_periodo: { organigrama_id: orgId, periodo } },
    include: { liquidaciones: { where: { empleado_id: empleadoId } } },
  });
  if (!cierre) throw new NominaError('El período no está cerrado', 409);
  const liq = cierre.liquidaciones[0];
  if (!liq) throw new NominaError('El trabajador no está en ese cierre', 404);
  const adh = await prisma.nominaAdhesion.findUnique({ where: { empleado_id: empleadoId } });
  if (!adh || adh.organigrama_id !== orgId) throw new NominaError('El trabajador no adhirió al recibo digital', 409);
  if (await prisma.nominaConstancia.findUnique({ where: { organigrama_id_periodo_empleado_id: { organigrama_id: orgId, periodo, empleado_id: empleadoId } } })) {
    throw new NominaError('Este recibo ya está firmado', 409);
  }
  if (input.leido !== true) throw new NominaError('Marcá que recibiste y leíste el recibo');
  const pin = typeof input.pin === 'string' ? input.pin.trim() : '';
  if (!pin) throw new NominaError('Ingresá tu PIN');
  checkPinThrottle(empleadoId);
  if (pinHash(pin, adh.cuil) !== adh.pin_hash) {
    pinFallo(empleadoId);
    throw new NominaError('PIN incorrecto');
  }
  pinFallos.delete(empleadoId);
  const conformidad = input.conformidad === 'disconforme' ? 'disconforme' : 'conforme';
  const observaciones = (typeof input.observaciones === 'string' ? input.observaciones.trim() : '').slice(0, 2000);
  if (conformidad === 'disconforme' && !observaciones) throw new NominaError('Indicá qué observás para firmar en disconformidad');

  const row = await prisma.$transaction(async (tx) => {
    // Prisma manda el número como bigint (la firma (int, int) exige el cast) y
    // no sabe deserializar el `void` que devuelve la función: $executeRaw ignora
    // el resultado.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('nomina_cadena'), ${orgId}::int)`;
    const last = await tx.nominaConstancia.findFirst({ where: { organigrama_id: orgId }, orderBy: [{ fecha: 'desc' }, { id: 'desc' }] });
    const fecha = new Date().toISOString();
    const prev = last?.chain_hash ?? GENESIS;
    const base = { hash: liq.hash, fecha, empleado_id: empleadoId, periodo, conformidad, observaciones };
    return tx.nominaConstancia.create({
      data: {
        organigrama_id: orgId, periodo, empleado_id: empleadoId, hash: liq.hash, prev_hash: prev, chain_hash: chainHash(prev, base),
        fecha, conformidad, observaciones, canal: 'kiosco',
        firmante: { empId: empleadoId, nombre: liq.nombre, cuil: adh.cuil },
        dispositivo: input.dispositivo.slice(0, 80), leido: true,
      },
    });
  });
  return toConstancia(row);
}

export async function verificarCadenaOrg(orgId: number): Promise<{ total: number; rotos: number }> {
  const rows = await prisma.nominaConstancia.findMany({ where: { organigrama_id: orgId }, orderBy: [{ fecha: 'asc' }, { id: 'asc' }] });
  return verificarCadena(rows);
}

export async function getRecibos(orgId: number): Promise<RecibosData> {
  const [config, maestro, adhesiones, cadena, cierres] = await Promise.all([
    getConfig(orgId), getMaestro(orgId), adhesionesDe(orgId), verificarCadenaOrg(orgId),
    prisma.nominaCierre.findMany({
      where: { organigrama_id: orgId },
      orderBy: { periodo: 'desc' },
      include: { liquidaciones: { include: { empleado: { select: SELECT_EMPLEADO } }, orderBy: { id: 'asc' } } },
    }),
  ]);
  const constancias = await prisma.nominaConstancia.findMany({ where: { organigrama_id: orgId } });
  const cst = new Map(constancias.map((c) => [c.periodo + '|' + c.empleado_id, c]));
  return {
    empresaOk: !!(config.empresa.razonSocial && config.empresa.cuit),
    cadena,
    adhesiones: maestro.map((r) => ({ empleado: r.empleado, cuil: r.maestro.cuil, adhesion: adhesiones[r.empleado.id] ?? null })),
    periodos: cierres.map((c) => {
      const rows: ReciboRow[] = c.liquidaciones.map((l) => {
        const k = cst.get(c.periodo + '|' + l.empleado_id);
        return {
          empleado: toEmpleado(l.empleado), liquidacionId: l.id, neto: l.neto, adherido: !!adhesiones[l.empleado_id],
          constancia: k ? toConstancia(k) : null, hashOk: k ? k.hash === l.hash : null,
        };
      });
      return { periodo: c.periodo, fechaCierre: c.fecha_cierre, firmados: rows.filter((r) => r.constancia).length, rows };
    }),
  };
}

/** Recibo de un empleado en un período: snapshot si está cerrado, en vivo si no. */
export async function getReciboVista(orgId: number, periodo: string, empleadoId: number): Promise<ReciboVista> {
  const empleado = await empleadoDeOrg(orgId, empleadoId);
  const cierre = await prisma.nominaCierre.findUnique({
    where: { organigrama_id_periodo: { organigrama_id: orgId, periodo } },
    include: { liquidaciones: { where: { empleado_id: empleadoId } } },
  });
  const adh = await prisma.nominaAdhesion.findUnique({ where: { empleado_id: empleadoId } });
  if (cierre) {
    const row = cierre.liquidaciones[0];
    if (!row) throw new NominaError('El trabajador no está en ese cierre', 404);
    const l = liqDesdeSnapshot(row);
    const empresa = mergeEmpresa(cierre.empresa_snapshot);
    const snap = row.maestro_snapshot as unknown as MaestroSnapshot;
    const k = await prisma.nominaConstancia.findUnique({ where: { organigrama_id_periodo_empleado_id: { organigrama_id: orgId, periodo, empleado_id: empleadoId } } });
    return {
      periodo, cerrado: true, fechaCierre: cierre.fecha_cierre, liquidacion: l, meta: reciboMeta(l, empresa, snap, periodo),
      hash: row.hash, constancia: k ? toConstancia(k) : null, adhesion: adh ? toAdhesion(adh) : null, foto_archivo: empleado.foto_archivo,
    };
  }
  const ctx = await contextoLiquidacion(orgId, periodo);
  const r = ctx.incluidos.find((x) => x.empleado.id === empleadoId);
  if (!r) throw new NominaError('El trabajador no está incluido en la liquidación', 404);
  const l = liquidarEmpleado({
    empleado: r.empleado, maestro: r.maestro, novedad: ctx.novedades[empleadoId] ?? { ...DEFAULT_NOVEDAD },
    params: ctx.config.params, conceptos: ctx.conceptos, periodo, liqAnterior: ctx.liqAnterior,
  });
  return {
    periodo, cerrado: false, fechaCierre: null, liquidacion: l, meta: reciboMeta(l, ctx.config.empresa, maestroSnapshot(r.maestro), periodo),
    hash: null, constancia: null, adhesion: adh ? toAdhesion(adh) : null, foto_archivo: empleado.foto_archivo,
  };
}

/** Recibos cerrados de una ficha (pestaña "Recibos" del organigrama). */
export async function getRecibosDeEmpleado(empleadoId: number): Promise<ReciboDeEmpleado[]> {
  const rows = await prisma.nominaLiquidacion.findMany({
    where: { empleado_id: empleadoId },
    include: { cierre: { include: { organigrama: { select: { id: true, nombre: true } } } } },
    orderBy: { cierre: { periodo: 'desc' } },
  });
  if (!rows.length) return [];
  const constancias = await prisma.nominaConstancia.findMany({ where: { empleado_id: empleadoId }, select: { organigrama_id: true, periodo: true, conformidad: true, fecha: true } });
  const cst = new Map(constancias.map((c) => [c.organigrama_id + '|' + c.periodo, c]));
  return rows.map((r) => {
    const k = cst.get(r.cierre.organigrama_id + '|' + r.cierre.periodo);
    return {
      liquidacionId: r.id, organigramaId: r.cierre.organigrama.id, organigramaNombre: r.cierre.organigrama.nombre,
      periodo: r.cierre.periodo, fechaCierre: r.cierre.fecha_cierre, neto: r.neto,
      constancia: k ? { conformidad: k.conformidad, fecha: k.fecha } : null,
    };
  });
}

/**
 * ¿Hay historial de nómina que impida borrar? Con empleado: sus liquidaciones
 * cerradas, adhesión o constancias. Sin empleado: cualquier cierre/adhesión/
 * constancia del sistema (usado por el reset del organigrama).
 */
export async function tieneHistorialNomina(empleadoId?: number): Promise<boolean> {
  const where = empleadoId ? { empleado_id: empleadoId } : {};
  const [liq, adh, cst] = await Promise.all([
    prisma.nominaLiquidacion.count({ where }),
    prisma.nominaAdhesion.count({ where }),
    prisma.nominaConstancia.count({ where }),
  ]);
  return liq + adh + cst > 0;
}
