/**
 * Recibos de sueldo emitidos por Finnegans: índice del mes, importación de la
 * sábana con conciliación y lectura del recibo propio. Ver CLAUDE.md › "Recibos
 * de Finnegans". Prisma + fs: solo servidor.
 *
 * Flujo:
 * 1. `buscarLiquidaciones(periodo)`: 1 llamada paga a RESUMENLIQ (todas las empresas)
 *    → una `NominaFinnLiquidacion` por transacción, vinculada al organigrama cuyo
 *    `NominaConfig.empresa.cuit` coincide.
 * 2. `importarLiquidacion(tx)`: 1 llamada paga para bajar la sábana (se guarda y se
 *    reutiliza), se asigna cada página a un legajo por CUIL, se vincula con la
 *    ficha por `NominaEmpleado.cuil` y, si TODO coincide, se parte en un PDF por
 *    persona con su SHA-256. Cualquier diferencia → no se publica nada.
 * 3. `enviarAviso`: RR.HH. avisa por mail (sin adjuntos) que los recibos están disponibles.
 * 4. `misRecibos` / `reciboPropio` / `firmarRecibo`: el empleado ve y firma SOLO lo suyo,
 *    desde el portal con su PIN; el hash se verifica antes de entregar y antes de firmar.
 */

import { createHash, randomUUID } from 'crypto';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { NominaError, comprobarPin, toConstancia, type ConstanciaView } from './nomina';
import { PERIODO_RE } from './nomina-datos';
import { GENESIS, chainHash } from './nomina-hash';
import { estadoBloqueo } from './nomina-pin';
import { getResumenLiq, getSabana, TeamplaceError, type InfoLlamada } from './teamplace';
import {
  agruparPorTransaccion,
  asignarPaginas,
  estadoEntrega,
  soloDigitos,
  validarFirmaInput,
  type EstadoEntrega,
  type FilaResumenLiq,
} from './recibos-finnegans-calc';
import { extraerTextos, partirPorGrupos } from './recibos-pdf';
import { appUrl, enviarMail, modoMail, type ModoMail, type ResultadoMail } from './mail';
import { armarMailAviso, emailValido } from './recibos-aviso';

export const SABANAS_DIR = join(process.cwd(), 'uploads', 'nomina', 'sabanas');
export const RECIBOS_DIR = join(process.cwd(), 'uploads', 'nomina', 'recibos');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sha256(b: Uint8Array): string {
  return createHash('sha256').update(b).digest('hex');
}

// ─── Consumo de la API (interacciones pagas) ────────────────────────────────

/** El tope de Finnegans es por cuenta y las keys se comparten con CentralSM. */
export function topeMensual(): number {
  const n = Number(process.env.FINNEGANS_TOPE_MENSUAL);
  return Number.isInteger(n) && n > 0 ? n : 80;
}

/** Inicio del mes calendario en hora argentina (-03:00, sin DST). */
function inicioMesArgentina(ahora = new Date()): Date {
  const ar = new Date(ahora.getTime() - 3 * 3600_000);
  return new Date(Date.UTC(ar.getUTCFullYear(), ar.getUTCMonth(), 1, 3));
}

export interface ConsumoMes {
  usadas: number;
  tope: number;
}

export async function consumoMes(): Promise<ConsumoMes> {
  const usadas = await prisma.nominaFinnLlamada.count({ where: { fecha: { gte: inicioMesArgentina() } } });
  return { usadas, tope: topeMensual() };
}

/** Corre una llamada paga: corta si se llegó al tope y registra cada interacción. */
async function llamadaPaga<T>(usuario: string | null, fn: (on: (i: InfoLlamada) => Promise<void>) => Promise<T>): Promise<T> {
  const { usadas, tope } = await consumoMes();
  if (usadas >= tope) {
    throw new NominaError(
      `Se alcanzó el tope de ${tope} llamadas pagas a Finnegans este mes (FINNEGANS_TOPE_MENSUAL). No se hizo la consulta.`,
      429,
    );
  }
  const registrar = async (i: InfoLlamada) => {
    await prisma.nominaFinnLlamada.create({
      data: { endpoint: i.endpoint, detalle: i.detalle, ok: i.ok, http: i.http, usuario },
    });
  };
  try {
    return await fn(registrar);
  } catch (e) {
    if (e instanceof TeamplaceError) throw new NominaError(e.message, 502);
    throw e;
  }
}

// ─── Índice de liquidaciones ────────────────────────────────────────────────

/** CUIT (solo dígitos) → organigrama, según `NominaConfig.empresa.cuit`. */
async function organigramasPorCuit(): Promise<Map<string, number>> {
  const configs = await prisma.nominaConfig.findMany({ select: { organigrama_id: true, empresa: true } });
  const mapa = new Map<string, number>();
  for (const c of configs) {
    const cuit = soloDigitos((c.empresa as { cuit?: unknown } | null)?.cuit);
    if (cuit.length === 11) mapa.set(cuit, c.organigrama_id);
  }
  return mapa;
}

function rangoDelPeriodo(periodo: string): { desde: string; hasta: string } {
  const [y, m] = periodo.split('-').map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { desde: `${periodo}-01`, hasta: `${periodo}-${String(ultimo).padStart(2, '0')}` };
}

export interface ResultadoBusqueda {
  periodo: string;
  liquidaciones: number;
  nuevas: number;
  sinOrganigrama: { empresa: string; cuit: string }[];
}

/**
 * Consulta RESUMENLIQ del mes (1 llamada paga) y registra/actualiza una liquidación
 * por transacción. Las ya importadas no se tocan.
 */
export async function buscarLiquidaciones(periodo: string, usuario: string | null): Promise<ResultadoBusqueda> {
  if (!PERIODO_RE.test(periodo)) throw new NominaError('Período inválido (yyyy-mm)', 400);
  const { desde, hasta } = rangoDelPeriodo(periodo);
  const filas = await llamadaPaga(usuario, (on) => getResumenLiq(desde, hasta, on));

  const porTx = new Map<number, FilaResumenLiq[]>();
  for (const f of filas) {
    const tx = Number(f.TRANSACCIONID);
    porTx.set(tx, [...(porTx.get(tx) ?? []), f]);
  }
  const indice = agruparPorTransaccion(filas);
  const orgs = await organigramasPorCuit();
  let nuevas = 0;
  const sinOrg = new Map<string, string>();

  for (const l of indice) {
    const organigramaId = orgs.get(l.empresaCuit) ?? null;
    if (organigramaId == null) sinOrg.set(l.empresaCuit, l.empresaNombre);
    const datos = {
      organigrama_id: organigramaId,
      empresa_cuit: l.empresaCuit,
      empresa_nombre: l.empresaNombre,
      nro_liquidacion: l.nroLiquidacion,
      tipo_liquidacion: l.tipoLiquidacion,
      periodo: l.periodo,
      fecha_desde: l.fechaDesde,
      fecha_hasta: l.fechaHasta,
      fecha_pago: l.fechaPago,
      legajos: l.legajos.length,
      filas: (porTx.get(l.transaccionId) ?? []) as object[],
    };
    const existente = await prisma.nominaFinnLiquidacion.findUnique({ where: { transaccion_id: l.transaccionId } });
    if (!existente) {
      await prisma.nominaFinnLiquidacion.create({ data: { transaccion_id: l.transaccionId, ...datos } });
      nuevas++;
    } else if (existente.estado !== 'importada') {
      // Puede haberse rehecho en Finnegans antes de importarla: se refresca el índice.
      await prisma.nominaFinnLiquidacion.update({ where: { id: existente.id }, data: datos });
    }
  }
  return {
    periodo,
    liquidaciones: indice.length,
    nuevas,
    sinOrganigrama: [...sinOrg].map(([cuit, empresa]) => ({ empresa, cuit })),
  };
}

export interface LiquidacionFinnView {
  transaccionId: number;
  nroLiquidacion: number;
  empresa: string;
  tipoLiquidacion: string;
  periodo: string;
  fechaPago: string;
  legajos: number;
  estado: string;
  diferencias: string[];
  recibos: number;
  importadaEn: string | null;
  importadaPor: string | null;
}

export async function listarLiquidaciones(
  orgId: number,
  periodo: string,
): Promise<{ liquidaciones: LiquidacionFinnView[]; sinOrganigrama: number; consumo: ConsumoMes }> {
  if (!PERIODO_RE.test(periodo)) throw new NominaError('Período inválido (yyyy-mm)', 400);
  const [rows, sinOrganigrama, consumo] = await Promise.all([
    prisma.nominaFinnLiquidacion.findMany({
      where: { organigrama_id: orgId, periodo },
      orderBy: { nro_liquidacion: 'asc' },
      include: { _count: { select: { recibos: true } } },
    }),
    prisma.nominaFinnLiquidacion.count({ where: { organigrama_id: null, periodo } }),
    consumoMes(),
  ]);
  return {
    liquidaciones: rows.map((r) => ({
      transaccionId: r.transaccion_id,
      nroLiquidacion: r.nro_liquidacion,
      empresa: r.empresa_nombre,
      tipoLiquidacion: r.tipo_liquidacion,
      periodo: r.periodo,
      fechaPago: r.fecha_pago,
      legajos: r.legajos,
      estado: r.estado,
      diferencias: Array.isArray(r.diferencias) ? (r.diferencias as string[]) : [],
      recibos: r._count.recibos,
      importadaEn: r.importada_en?.toISOString() ?? null,
      importadaPor: r.importada_por,
    })),
    sinOrganigrama,
    consumo,
  };
}

// ─── Importación ────────────────────────────────────────────────────────────

export type ResultadoImportacion =
  | { ok: true; recibos: number; yaImportada: boolean; sabanaReutilizada: boolean }
  | { ok: false; diferencias: string[]; sabanaReutilizada: boolean };

/** Sábana guardada y sana (mismo hash que al bajarla), o null. */
function sabanaGuardada(archivo: string | null, hash: string | null): Uint8Array | null {
  if (!archivo || !hash) return null;
  const ruta = join(SABANAS_DIR, archivo);
  if (!existsSync(ruta)) return null;
  const buf = new Uint8Array(readFileSync(ruta));
  return sha256(buf) === hash ? buf : null;
}

export async function importarLiquidacion(transaccionId: number, usuario: string | null): Promise<ResultadoImportacion> {
  const liq = await prisma.nominaFinnLiquidacion.findUnique({ where: { transaccion_id: transaccionId } });
  if (!liq) throw new NominaError('La liquidación no está en el índice: buscá primero las liquidaciones del mes.', 404);
  if (liq.estado === 'importada') {
    const recibos = await prisma.nominaReciboPdf.count({ where: { liquidacion_id: liq.id } });
    return { ok: true, recibos, yaImportada: true, sabanaReutilizada: true };
  }

  let orgId = liq.organigrama_id;
  if (orgId == null) {
    orgId = (await organigramasPorCuit()).get(liq.empresa_cuit) ?? null;
    if (orgId == null) {
      throw new NominaError(
        `${liq.empresa_nombre} (CUIT ${liq.empresa_cuit}) no está vinculada a ningún organigrama: cargá su CUIT en Nómina › Parámetros.`,
        409,
      );
    }
    await prisma.nominaFinnLiquidacion.update({ where: { id: liq.id }, data: { organigrama_id: orgId } });
  }

  // 1. Sábana: la guardada si está sana; si no, se baja (1 llamada paga).
  let sabana = sabanaGuardada(liq.sabana_archivo, liq.sabana_sha256);
  const sabanaReutilizada = sabana != null;
  if (!sabana) {
    sabana = await llamadaPaga(usuario, (on) => getSabana(transaccionId, on));
    const archivo = `${transaccionId}.pdf`;
    mkdirSync(SABANAS_DIR, { recursive: true });
    writeFileSync(join(SABANAS_DIR, archivo), sabana);
    await prisma.nominaFinnLiquidacion.update({
      where: { id: liq.id },
      data: { sabana_archivo: archivo, sabana_sha256: sha256(sabana) },
    });
  }

  // 2. Conciliación: páginas ↔ legajos de RESUMENLIQ ↔ fichas del organigrama.
  const [indice] = agruparPorTransaccion(liq.filas as FilaResumenLiq[]);
  const esperados = indice?.legajos ?? [];
  const textos = await extraerTextos(sabana);
  const { grupos, diferencias } = asignarPaginas(textos, esperados, liq.empresa_cuit);

  const fichas = await prisma.nominaEmpleado.findMany({
    where: { empleado: { organigrama_id: orgId } },
    select: { cuil: true, empleado_id: true },
  });
  const fichaPorCuil = new Map<string, number>();
  for (const f of fichas) {
    const c = soloDigitos(f.cuil);
    if (c.length !== 11) continue;
    if (fichaPorCuil.has(c) && fichaPorCuil.get(c) !== f.empleado_id) {
      diferencias.push(`El CUIL ${c} está cargado en más de una ficha del organigrama.`);
    }
    fichaPorCuil.set(c, f.empleado_id);
  }
  for (const e of esperados) {
    if (!fichaPorCuil.has(e.cuil)) {
      diferencias.push(`${e.nombre || e.cuil} (CUIL ${e.cuil}) no tiene ficha en el organigrama con ese CUIL.`);
    }
  }
  const yaPublicados = await prisma.nominaReciboPdf.findMany({
    where: { liquidacion_legajo_id: { in: esperados.map((e) => e.liquidacionLegajoId) } },
    select: { liquidacion_legajo_id: true },
  });
  for (const p of yaPublicados) diferencias.push(`El recibo ${p.liquidacion_legajo_id} ya está publicado en otra importación.`);

  if (diferencias.length > 0) {
    await prisma.nominaFinnLiquidacion.update({
      where: { id: liq.id },
      data: { estado: 'con_diferencias', diferencias },
    });
    return { ok: false, diferencias, sabanaReutilizada };
  }

  // 3. Publicación: un PDF por persona con su hash; todo o nada.
  const partes = await partirPorGrupos(sabana, grupos.map((g) => g.paginas));
  const porLegajo = new Map(esperados.map((e) => [e.liquidacionLegajoId, e]));
  const escritos: string[] = [];
  const anio = liq.periodo.slice(0, 4);
  try {
    const data = grupos.map((g, i) => {
      const id = randomUUID();
      const archivo = `${anio}/${id}.pdf`;
      const ruta = join(RECIBOS_DIR, archivo);
      mkdirSync(dirname(ruta), { recursive: true });
      writeFileSync(ruta, partes[i]);
      escritos.push(ruta);
      const e = porLegajo.get(g.liquidacionLegajoId)!;
      return {
        id,
        liquidacion_id: liq.id,
        organigrama_id: orgId,
        empleado_id: fichaPorCuil.get(g.cuil)!,
        liquidacion_legajo_id: g.liquidacionLegajoId,
        cuil: g.cuil,
        periodo: liq.periodo,
        tipo_liquidacion: liq.tipo_liquidacion,
        neto: e.neto,
        pagina: g.paginas[0] + 1,
        archivo,
        sha256: sha256(partes[i]),
        bytes: partes[i].length,
      };
    });
    await prisma.$transaction([
      prisma.nominaReciboPdf.createMany({ data }),
      prisma.nominaFinnLiquidacion.update({
        where: { id: liq.id },
        data: { estado: 'importada', diferencias: [], importada_en: new Date(), importada_por: usuario },
      }),
    ]);
    return { ok: true, recibos: data.length, yaImportada: false, sabanaReutilizada };
  } catch (e) {
    for (const r of escritos) {
      try {
        unlinkSync(r);
      } catch {
        /* ya no estaba */
      }
    }
    throw e;
  }
}

// ─── Lectura verificada del PDF ─────────────────────────────────────────────

type ReciboDb = NonNullable<Awaited<ReturnType<typeof prisma.nominaReciboPdf.findUnique>>>;

/** Lee el PDF del recibo y verifica su SHA-256. Si no coincide, no se entrega ni se firma. */
function leerReciboVerificado(r: ReciboDb): Uint8Array {
  let pdf: Uint8Array;
  try {
    pdf = new Uint8Array(readFileSync(join(RECIBOS_DIR, r.archivo)));
  } catch {
    throw new NominaError('El archivo del recibo no está disponible: avisá a RR.HH.', 410);
  }
  if (sha256(pdf) !== r.sha256) {
    console.error(`[recibos] hash distinto en recibo ${r.id} (${r.archivo})`);
    throw new NominaError('El archivo del recibo no coincide con el registrado: avisá a RR.HH.', 409);
  }
  return pdf;
}

function nombreArchivo(r: { periodo: string; tipo_liquidacion: string }, prefijo = 'recibo'): string {
  const tipo = r.tipo_liquidacion.normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  return `${prefijo}-${r.periodo}-${tipo}.pdf`;
}

// ─── Vista del empleado (portal, solo lectura) ──────────────────────────────

export interface MiReciboView {
  id: string;
  periodo: string;
  tipoLiquidacion: string;
  empresa: string;
  nroLiquidacion: number;
  fechaPago: string;
  neto: number;
  estado: string;
  accedidoEn: string | null;
  entrega: EstadoEntrega;
  firma: { conformidad: string; fecha: string } | null;
}

export async function misRecibos(empleadoId: number): Promise<MiReciboView[]> {
  const rows = await prisma.nominaReciboPdf.findMany({
    where: { empleado_id: empleadoId },
    include: {
      liquidacion: { select: { empresa_nombre: true, nro_liquidacion: true, fecha_pago: true } },
      constancia: { select: { conformidad: true, fecha: true } },
    },
    orderBy: [{ periodo: 'desc' }, { created_at: 'desc' }],
  });
  const hoy = new Date();
  return rows.map((r) => ({
    id: r.id,
    periodo: r.periodo,
    tipoLiquidacion: r.tipo_liquidacion,
    empresa: r.liquidacion.empresa_nombre,
    nroLiquidacion: r.liquidacion.nro_liquidacion,
    fechaPago: r.liquidacion.fecha_pago,
    neto: r.neto,
    estado: r.estado,
    accedidoEn: r.accedido_en?.toISOString() ?? null,
    entrega: estadoEntrega({ estado: r.estado, publicado: r.notificado_en ?? r.created_at }, hoy).estado,
    firma: r.constancia ? { conformidad: r.constancia.conformidad, fecha: r.constancia.fecha } : null,
  }));
}

/** Busca un recibo del propio empleado; ajeno o inexistente → 404 (nunca 403). */
async function reciboDelEmpleado(empleadoId: number, id: string): Promise<ReciboDb> {
  const noEncontrado = new NominaError('Recibo no encontrado', 404);
  if (!UUID_RE.test(id)) throw noEncontrado;
  const r = await prisma.nominaReciboPdf.findUnique({ where: { id } });
  if (!r || r.empleado_id !== empleadoId) throw noEncontrado;
  return r;
}

/**
 * El PDF de un recibo del propio empleado. Verifica el hash antes de entregarlo. El
 * primer acceso queda registrado (sin pisar un estado firmado o en papel).
 */
export async function reciboPropio(empleadoId: number, id: string): Promise<{ pdf: Uint8Array; nombre: string }> {
  const r = await reciboDelEmpleado(empleadoId, id);
  const pdf = leerReciboVerificado(r);
  if (!r.accedido_en) {
    await prisma.nominaReciboPdf.update({
      where: { id },
      data: { accedido_en: new Date(), ...(r.estado === 'disponible' ? { estado: 'accedido' } : {}) },
    });
  }
  return { pdf, nombre: nombreArchivo(r) };
}

/** Constancia de firma de un recibo propio (portal). Sin firma → null. */
export async function constanciaPropia(empleadoId: number, id: string): Promise<ConstanciaView | null> {
  await reciboDelEmpleado(empleadoId, id);
  const c = await prisma.nominaConstancia.findUnique({ where: { recibo_id: id } });
  return c ? toConstancia(c) : null;
}

// ─── Firma desde el portal (celular del trabajador) ────────────────────────

export interface FirmaReciboInput {
  pin: unknown;
  conformidad: unknown;
  observaciones: unknown;
  leido: unknown;
  dispositivo: string;
  ip: string;
}

/**
 * Firma de un recibo propio desde el portal (usuario + PIN). La ficha sale de la sesión y el
 * recibo tiene que ser suyo (404 si no). Orden: recibo propio → adhesión COMPLETA (con acta)
 * y mismo CUIL → hash del PDF → bloqueo → entrada (lectura, conformidad explícita,
 * observaciones) → PIN (scrypt; los fallos se guardan) → constancia encadenada bajo lock,
 * re-chequeando dentro de la transacción que no esté firmado. Disconforme → caso para RR.HH.
 */
export async function firmarRecibo(empleadoId: number, reciboId: string, input: FirmaReciboInput): Promise<ConstanciaView> {
  const propio = await reciboDelEmpleado(empleadoId, reciboId); // 404 si no es suyo
  const r = await prisma.nominaReciboPdf.findUnique({ where: { id: propio.id }, include: { empleado: { select: { nombre: true } } } });
  if (!r) throw new NominaError('Recibo no encontrado', 404);
  if (r.estado === 'firmado') throw new NominaError('Este recibo ya está firmado', 409);
  if (r.estado === 'papel') throw new NominaError('Este recibo se te entregó en papel: no se firma en el portal', 409);

  const adh = await prisma.nominaAdhesion.findUnique({ where: { empleado_id: r.empleado_id } });
  if (!adh) throw new NominaError('No adheriste al recibo digital: acercate a RR.HH. para hacerlo', 409);
  if (!adh.acta_archivo) throw new NominaError('Tu adhesión está pendiente: RR.HH. todavía no cargó el acta firmada', 409);
  if (soloDigitos(adh.cuil) !== soloDigitos(r.cuil)) {
    throw new NominaError('El CUIL de tu adhesión no coincide con el del recibo: avisá a RR.HH.', 409);
  }

  leerReciboVerificado(r); // 409 si el PDF cambió: no se firma algo distinto de lo publicado

  const bloqueo = estadoBloqueo(adh.pin_bloqueado_hasta);
  if (bloqueo.bloqueado) {
    throw new NominaError(`Demasiados PIN incorrectos: esperá ${Math.ceil(bloqueo.segundos / 60)} min. Si olvidaste tu PIN, RR.HH. tiene que renovar tu adhesión`, 429);
  }
  const v = validarFirmaInput(input);
  if (!v.ok) throw new NominaError(v.error, 400);

  await comprobarPin(
    adh.id, v.firma.pin, adh.cuil, adh.pin_hash, 'PIN incorrecto',
    'Demasiados PIN incorrectos: esperá unos minutos. Si olvidaste tu PIN, RR.HH. tiene que renovar tu adhesión',
  );

  const { conformidad, observaciones } = v.firma;
  const orgId = r.organigrama_id;
  try {
    const row = await prisma.$transaction(async (tx) => {
      // Serializa las firmas del organigrama: la cadena nunca se bifurca.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('nomina_cadena'), ${orgId}::int)`;
      const actual = await tx.nominaReciboPdf.findUnique({ where: { id: r.id }, select: { estado: true } });
      if (actual?.estado === 'firmado' || actual?.estado === 'papel') throw new NominaError('Este recibo ya está firmado', 409);
      const last = await tx.nominaConstancia.findFirst({ where: { organigrama_id: orgId }, orderBy: [{ fecha: 'desc' }, { id: 'desc' }] });
      const fecha = new Date().toISOString();
      const prev = last?.chain_hash ?? GENESIS;
      const base = { hash: r.sha256, fecha, empleado_id: r.empleado_id, periodo: r.periodo, recibo_id: r.id, conformidad, observaciones };
      const c = await tx.nominaConstancia.create({
        data: {
          organigrama_id: orgId, periodo: r.periodo, empleado_id: r.empleado_id, recibo_id: r.id, hash: r.sha256,
          prev_hash: prev, chain_hash: chainHash(prev, base), fecha, conformidad, observaciones, canal: 'portal',
          firmante: { empId: r.empleado_id, nombre: r.empleado.nombre, cuil: adh.cuil, adhesion: adh.codigo ?? '' },
          dispositivo: input.dispositivo.slice(0, 200), ip: input.ip.slice(0, 64), leido: true,
        },
      });
      await tx.nominaReciboPdf.update({ where: { id: r.id }, data: { estado: 'firmado' } });
      if (conformidad === 'disconforme') {
        await tx.nominaCasoRecibo.create({ data: { constancia_id: c.id, organigrama_id: orgId, empleado_id: r.empleado_id } });
      }
      return c;
    });
    return toConstancia(row);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new NominaError('Este recibo ya está firmado', 409);
    }
    throw e;
  }
}

/** Datos del recibo propio para la pantalla de firma (sin el PDF). */
export async function reciboParaFirmar(empleadoId: number, id: string): Promise<MiReciboView & { sha256: string }> {
  const r = await reciboDelEmpleado(empleadoId, id);
  const [vista] = (await misRecibos(empleadoId)).filter((x) => x.id === r.id);
  return { ...vista, sha256: r.sha256 };
}

/** PDF de un recibo para el panel de RR.HH., con verificación del hash. */
export async function pdfReciboAdmin(id: string): Promise<{ pdf: Uint8Array; nombre: string }> {
  if (!UUID_RE.test(id)) throw new NominaError('Recibo no encontrado', 404);
  const r = await prisma.nominaReciboPdf.findUnique({ where: { id } });
  if (!r) throw new NominaError('Recibo no encontrado', 404);
  return { pdf: leerReciboVerificado(r), nombre: nombreArchivo(r) };
}

// ─── Aviso por mail: "tus recibos están disponibles" ───────────────────────

export interface DestinatarioAviso {
  empleadoId: number;
  nombre: string;
  email: string;
  recibos: number;
  yaAvisado: boolean;
}

export interface SinAviso {
  empleadoId: number;
  nombre: string;
  motivo: 'sin_adhesion' | 'pendiente_acta' | 'sin_email';
  recibos: number;
}

export interface PreviaAviso {
  modo: ModoMail;
  destinatarios: DestinatarioAviso[];
  sinAviso: SinAviso[];
}

/**
 * Quiénes recibirían el aviso: personas del organigrama con recibos del período sin firmar ni
 * entregar en papel. Solo se avisa a quien tiene la adhesión completa y email declarado; el
 * resto figura en `sinAviso` (se le entrega en papel o hay que completar su adhesión).
 */
export async function previaAviso(orgId: number, periodo: string): Promise<PreviaAviso> {
  if (!PERIODO_RE.test(periodo)) throw new NominaError('Período inválido (yyyy-mm)', 400);
  const rows = await prisma.nominaReciboPdf.findMany({
    where: { organigrama_id: orgId, periodo, estado: { in: ['disponible', 'accedido'] } },
    include: { empleado: { select: { nombre: true, nomina_adhesion: { select: { acta_archivo: true, email: true } } } } },
  });
  const porPersona = new Map<number, { nombre: string; adh: { acta_archivo: string | null; email: string | null } | null; recibos: number; avisados: number }>();
  for (const r of rows) {
    const p = porPersona.get(r.empleado_id) ?? { nombre: r.empleado.nombre, adh: r.empleado.nomina_adhesion, recibos: 0, avisados: 0 };
    p.recibos++;
    if (r.notificado_en) p.avisados++;
    porPersona.set(r.empleado_id, p);
  }
  const destinatarios: DestinatarioAviso[] = [];
  const sinAviso: SinAviso[] = [];
  for (const [empleadoId, p] of porPersona) {
    if (!p.adh) sinAviso.push({ empleadoId, nombre: p.nombre, motivo: 'sin_adhesion', recibos: p.recibos });
    else if (!p.adh.acta_archivo) sinAviso.push({ empleadoId, nombre: p.nombre, motivo: 'pendiente_acta', recibos: p.recibos });
    else if (!emailValido(p.adh.email)) sinAviso.push({ empleadoId, nombre: p.nombre, motivo: 'sin_email', recibos: p.recibos });
    else destinatarios.push({ empleadoId, nombre: p.nombre, email: p.adh.email, recibos: p.recibos, yaAvisado: p.avisados === p.recibos });
  }
  const orden = (a: { nombre: string }, b: { nombre: string }) => a.nombre.localeCompare(b.nombre, 'es');
  return { modo: modoMail(), destinatarios: destinatarios.sort(orden), sinAviso: sinAviso.sort(orden) };
}

export interface ResultadoAviso {
  avisoId: number;
  modo: ModoMail;
  enviados: number;
  fallidos: { nombre: string; error: string }[];
  sinAviso: number;
}

/**
 * Manda el aviso a todos los destinatarios de `previaAviso` (botón de RR.HH.). Registra el
 * envío y sus destinatarios (prueba de la puesta a disposición) y marca `notificado_en` en los
 * recibos avisados que todavía no lo tenían. Volver a apretarlo reenvía a los pendientes
 * (sirve de recordatorio); la fecha del primer aviso no se pisa.
 */
export async function enviarAviso(orgId: number, periodo: string, usuario: string | null): Promise<ResultadoAviso> {
  const previa = await previaAviso(orgId, periodo);
  if (previa.destinatarios.length === 0) {
    throw new NominaError('No hay a quién avisar: nadie con recibos pendientes tiene la adhesión completa y email', 409);
  }
  const org = await prisma.organigrama.findUnique({ where: { id: orgId }, select: { nombre: true } });
  const url = `${appUrl()}/admin/mis-recibos`;
  const resultados: { d: DestinatarioAviso; r: ResultadoMail }[] = [];
  for (const d of previa.destinatarios) {
    const mail = armarMailAviso({ nombre: d.nombre, empresa: org?.nombre ?? '', periodo, recibos: d.recibos, url });
    resultados.push({ d, r: await enviarMail({ to: d.email, ...mail }) });
  }
  const ahora = new Date();
  const okIds = resultados.filter((x) => x.r.ok).map((x) => x.d.empleadoId);
  const aviso = await prisma.$transaction(async (tx) => {
    const a = await tx.nominaAviso.create({
      data: {
        organigrama_id: orgId, periodo, modo: previa.modo, enviado_por: usuario,
        enviados: okIds.length, fallidos: resultados.length - okIds.length,
        destinatarios: {
          create: resultados.map(({ d, r }) => ({
            empleado_id: d.empleadoId, email: d.email, recibos: d.recibos,
            estado: r.ok ? 'enviado' : 'error', error: r.ok ? '' : r.error, message_id: r.ok ? r.messageId : '',
          })),
        },
      },
    });
    if (okIds.length) {
      await tx.nominaReciboPdf.updateMany({
        where: { organigrama_id: orgId, periodo, empleado_id: { in: okIds }, estado: { in: ['disponible', 'accedido'] }, notificado_en: null },
        data: { notificado_en: ahora },
      });
    }
    return a;
  });
  return {
    avisoId: aviso.id,
    modo: previa.modo,
    enviados: okIds.length,
    fallidos: resultados.filter((x) => !x.r.ok).map(({ d, r }) => ({ nombre: d.nombre, error: r.ok ? '' : r.error })),
    sinAviso: previa.sinAviso.length,
  };
}

export interface AvisoView {
  id: number;
  fecha: string;
  modo: string;
  enviados: number;
  fallidos: number;
  enviadoPor: string | null;
}

export async function listarAvisos(orgId: number, periodo: string): Promise<AvisoView[]> {
  const rows = await prisma.nominaAviso.findMany({ where: { organigrama_id: orgId, periodo }, orderBy: { created_at: 'desc' } });
  return rows.map((a) => ({
    id: a.id, fecha: a.created_at.toISOString(), modo: a.modo, enviados: a.enviados, fallidos: a.fallidos, enviadoPor: a.enviado_por,
  }));
}

// ─── Panel de RR.HH.: recibos del período, papel y disconformidades ────────

export interface ReciboPanelView {
  id: string;
  empleadoId: number;
  nombre: string;
  tipoLiquidacion: string;
  neto: number;
  entrega: EstadoEntrega;
  dias: number;
  adherido: boolean;
  constancia: ConstanciaView | null;
  caso: { id: number; estado: string } | null;
  papel: { registradoEn: string | null; registradoPor: string | null } | null;
}

export interface PanelRecibos {
  recibos: ReciboPanelView[];
  resumen: { total: number; firmados: number; pendientes: number; noRetirados: number; papel: number; disconformes: number };
  casosAbiertos: number;
}

export async function panelRecibos(orgId: number, periodo: string): Promise<PanelRecibos> {
  if (!PERIODO_RE.test(periodo)) throw new NominaError('Período inválido (yyyy-mm)', 400);
  const [rows, casosAbiertos] = await Promise.all([
    prisma.nominaReciboPdf.findMany({
      where: { organigrama_id: orgId, periodo },
      include: {
        empleado: { select: { nombre: true, nomina_adhesion: { select: { acta_archivo: true } } } },
        constancia: { include: { caso: { select: { id: true, estado: true } } } },
      },
      orderBy: [{ empleado: { nombre: 'asc' } }, { created_at: 'asc' }],
    }),
    prisma.nominaCasoRecibo.count({ where: { organigrama_id: orgId, estado: 'abierto' } }),
  ]);
  const hoy = new Date();
  const recibos: ReciboPanelView[] = rows.map((r) => {
    const e = estadoEntrega({ estado: r.estado, publicado: r.notificado_en ?? r.created_at }, hoy);
    return {
      id: r.id,
      empleadoId: r.empleado_id,
      nombre: r.empleado.nombre,
      tipoLiquidacion: r.tipo_liquidacion,
      neto: r.neto,
      entrega: e.estado,
      dias: e.dias,
      adherido: !!r.empleado.nomina_adhesion?.acta_archivo,
      constancia: r.constancia ? toConstancia(r.constancia) : null,
      caso: r.constancia?.caso ?? null,
      papel: r.estado === 'papel'
        ? { registradoEn: r.papel_registrado_en?.toISOString() ?? null, registradoPor: r.papel_registrado_por }
        : null,
    };
  });
  const cuenta = (x: EstadoEntrega) => recibos.filter((r) => r.entrega === x).length;
  return {
    recibos,
    resumen: {
      total: recibos.length,
      firmados: cuenta('firmado'),
      pendientes: cuenta('pendiente'),
      noRetirados: cuenta('no_retirado'),
      papel: cuenta('papel'),
      disconformes: recibos.filter((r) => r.constancia?.conformidad === 'disconforme').length,
    },
    casosAbiertos,
  };
}

export const PAPEL_DIR = join(process.cwd(), 'uploads', 'nomina', 'papel');
export const PAPEL_MAX_BYTES = 15 * 1024 * 1024;

/**
 * Entrega en papel: RR.HH. sube el escaneo del recibo impreso y firmado a mano (quien
 * no adhirió, no lo retiró a tiempo o ya no puede venir). Excluye la firma electrónica.
 */
export async function registrarEntregaPapel(reciboId: string, pdf: Uint8Array, usuario: string | null): Promise<void> {
  if (!UUID_RE.test(reciboId)) throw new NominaError('Recibo no encontrado', 404);
  const r = await prisma.nominaReciboPdf.findUnique({ where: { id: reciboId } });
  if (!r) throw new NominaError('Recibo no encontrado', 404);
  if (r.estado === 'firmado') throw new NominaError('El recibo ya está firmado electrónicamente', 409);
  if (r.estado === 'papel') throw new NominaError('La entrega en papel ya está registrada', 409);
  if (pdf.length === 0 || pdf.length > PAPEL_MAX_BYTES) throw new NominaError('El PDF debe pesar como mucho 15 MB', 400);
  if (String.fromCharCode(...pdf.subarray(0, 4)) !== '%PDF') throw new NominaError('El archivo no es un PDF válido', 400);
  const archivo = `${randomUUID()}.pdf`;
  mkdirSync(PAPEL_DIR, { recursive: true });
  writeFileSync(join(PAPEL_DIR, archivo), pdf);
  try {
    const n = await prisma.nominaReciboPdf.updateMany({
      where: { id: r.id, estado: { in: ['disponible', 'accedido'] } },
      data: {
        estado: 'papel', papel_archivo: archivo, papel_sha256: sha256(pdf),
        papel_registrado_en: new Date(), papel_registrado_por: usuario,
      },
    });
    if (n.count !== 1) throw new NominaError('El recibo cambió de estado mientras se subía el escaneo', 409);
  } catch (e) {
    try {
      unlinkSync(join(PAPEL_DIR, archivo));
    } catch {
      /* ya no estaba */
    }
    throw e;
  }
}

export async function papelDeRecibo(reciboId: string): Promise<{ pdf: Uint8Array; nombre: string }> {
  if (!UUID_RE.test(reciboId)) throw new NominaError('Recibo no encontrado', 404);
  const r = await prisma.nominaReciboPdf.findUnique({ where: { id: reciboId } });
  if (!r?.papel_archivo) throw new NominaError('Ese recibo no tiene entrega en papel', 404);
  const pdf = new Uint8Array(readFileSync(join(PAPEL_DIR, r.papel_archivo)));
  if (r.papel_sha256 && sha256(pdf) !== r.papel_sha256) {
    throw new NominaError('El escaneo no coincide con el registrado', 409);
  }
  return { pdf, nombre: nombreArchivo(r, 'recibo-papel') };
}

export interface CasoView {
  id: number;
  estado: string;
  notas: string;
  creadoEn: string;
  resueltoEn: string | null;
  resueltoPor: string | null;
  nombre: string;
  periodo: string;
  tipoLiquidacion: string;
  observaciones: string;
  firmadoEn: string;
}

export async function listarCasos(orgId: number, estado: 'abierto' | 'resuelto' | 'todos' = 'abierto'): Promise<CasoView[]> {
  const rows = await prisma.nominaCasoRecibo.findMany({
    where: { organigrama_id: orgId, ...(estado === 'todos' ? {} : { estado }) },
    include: { constancia: { include: { empleado: { select: { nombre: true } }, recibo: { select: { tipo_liquidacion: true } } } } },
    orderBy: { created_at: 'desc' },
  });
  return rows.map((c) => ({
    id: c.id,
    estado: c.estado,
    notas: c.notas,
    creadoEn: c.created_at.toISOString(),
    resueltoEn: c.resuelto_en?.toISOString() ?? null,
    resueltoPor: c.resuelto_por,
    nombre: c.constancia.empleado.nombre,
    periodo: c.constancia.periodo,
    tipoLiquidacion: c.constancia.recibo.tipo_liquidacion,
    observaciones: c.constancia.observaciones,
    firmadoEn: c.constancia.fecha,
  }));
}

/** Anota y/o resuelve un caso. La constancia nunca se modifica. */
export async function actualizarCaso(id: number, data: { notas?: unknown; resolver?: unknown }, usuario: string | null): Promise<void> {
  const c = await prisma.nominaCasoRecibo.findUnique({ where: { id } });
  if (!c) throw new NominaError('Caso no encontrado', 404);
  const notas = typeof data.notas === 'string' ? data.notas.trim().slice(0, 4000) : undefined;
  const resolver = data.resolver === true;
  if (resolver && !(notas ?? c.notas)) throw new NominaError('Anotá cómo se resolvió antes de cerrar el caso', 400);
  await prisma.nominaCasoRecibo.update({
    where: { id },
    data: {
      ...(notas !== undefined ? { notas } : {}),
      ...(resolver && c.estado !== 'resuelto' ? { estado: 'resuelto', resuelto_en: new Date(), resuelto_por: usuario } : {}),
    },
  });
}
