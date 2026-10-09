/**
 * Vacaciones (solo servidor): arma la foto de la temporada desde la base y aplica las acciones del
 * motor puro (`vacaciones-calc.ts`) en una transacción con candado, dejando todo en la auditoría.
 *
 * Fuentes: personas, áreas y jefes del Organigrama (fichas activas y visibles); ingreso, categoría
 * y básico de Nómina › Maestro; el convenio del texto de la ficha (salvo que la ficha de
 * vacaciones lo fije). El sueldo solo viaja a quien también puede ver Nómina.
 */

import { ApiError } from './api-error';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { hoyLocal } from './fechas';
import { FECHA_RE } from './asistencia-datos';
import { empleadorPorCuil } from './nomina';
import {
  CRITERIOS_ORDEN, MAX_DIAS_TRAMO, MMDD_RE, acusarRecibo, agregarTramo, aprobar, aprobarReprogramacion,
  autorizarFueraTermino, cerrarTemporada, conformidadFraccionamiento, devolver, empById, enviar, errorRegla, existeConvenio, interrumpir,
  mezclarConfig, nombreDe, notificar, paraPortal, permutar, quitarTramo, reabrir, solVacia, sugerirInicio, validarTramo,
  vistaSeleccion, type AreaVac, type ConfigVacaciones, type Convenio, type EmpleadoVac, type EstadoVac, type Flag,
  type PerfilVac, type ReglaCobertura, type Resultado, type Solicitud, type VistaSeleccion,
} from './vacaciones-calc';

export class VacacionesError extends ApiError {}

/** Quién hace la acción (queda en la auditoría y en los acuerdos). */
export interface Actor { nombre: string; usuario: string | null; ip: string | null }

type Db = Prisma.TransactionClient | typeof prisma;

const FICHA_INACTIVA = 'La ficha no está activa en el organigrama';
/** Tope de movimientos que devuelve el historial (el más viejo queda afuera). */
const MAX_FILAS_AUDITORIA = 2000;

// ─── Lectura ────────────────────────────────────────────────────────────────

async function leerConfig(db: Db): Promise<ConfigVacaciones> {
  const row = await db.vacacionesConfig.findUnique({ where: { id: 1 } });
  return mezclarConfig(row?.params);
}

const json = <T>(v: Prisma.JsonValue | null | undefined, def: T): T => (v == null ? def : (v as unknown as T));

function solicitudDeFila(r: {
  estado: string; tramos: Prisma.JsonValue; enviada: string | null; motivo: string;
  acuerdo_fracc: Prisma.JsonValue; notificacion: Prisma.JsonValue; interrupciones: Prisma.JsonValue; autoriza_fuera_termino: boolean;
}): Solicitud {
  return {
    ...solVacia(),
    estado: r.estado as Solicitud['estado'],
    tramos: json(r.tramos, []),
    enviada: r.enviada,
    motivo: r.motivo,
    acuerdoFracc: json(r.acuerdo_fracc, null),
    notificacion: json(r.notificacion, null),
    interrupciones: json(r.interrupciones, []),
    autorizaFueraTermino: r.autoriza_fuera_termino,
  };
}

/**
 * Foto de la temporada en curso. `verSueldos = false` deja afuera básico y remuneración de
 * referencia (solo los usa el anticipo del art. 155).
 */
export async function cargarEstado(db: Db = prisma, verSueldos = true): Promise<EstadoVac> {
  const config = await leerConfig(db);
  const [emps, perfiles, areas, sols, orgs] = await Promise.all([
    db.orgEmpleado.findMany({
      where: { estado: 'active', oculto_en: null },
      select: {
        id: true, nombre: true, rol: true, area: true, organigrama_id: true, foto_archivo: true, convenio: true,
        nomina: { select: { fecha_ingreso: true, categoria: true, basico: true, cct: true, convenio: true } },
      },
      orderBy: { nombre: 'asc' },
    }),
    db.vacacionesPerfil.findMany(),
    db.orgArea.findMany({ include: { vacaciones: true }, orderBy: { nombre: 'asc' } }),
    db.vacacionesSolicitud.findMany({ where: { ejercicio: config.ejercicio } }),
    db.organigrama.findMany({ select: { id: true, nombre: true } }),
  ]);
  const nombreOrg = new Map(orgs.map((o) => [o.id, o.nombre] as const));
  const areaId = new Map(areas.map((a) => [`${a.organigrama_id}|${a.nombre}`, a.id] as const));

  const empleados: EmpleadoVac[] = emps.map((e) => ({
    id: e.id, nombre: e.nombre, rol: e.rol, area: e.area,
    areaId: areaId.get(`${e.organigrama_id}|${e.area}`) ?? null,
    organigramaId: e.organigrama_id, organigrama: (e.organigrama_id != null && nombreOrg.get(e.organigrama_id)) || '',
    fotoArchivo: e.foto_archivo,
    convenioTexto: e.convenio || e.nomina?.cct || e.nomina?.convenio || '',
    fechaIngreso: e.nomina?.fecha_ingreso ?? '',
    categoria: e.nomina?.categoria ?? '',
    basico: verSueldos ? e.nomina?.basico ?? 0 : 0,
  }));

  return {
    hoy: hoyLocal(),
    config,
    empleados,
    perfiles: Object.fromEntries(perfiles.map((p) => [p.empleado_id, {
      incluir: p.incluir, convenio: p.convenio, francoRotativo: p.franco_rotativo, diaDescanso: p.dia_descanso,
      diasTrabajados: p.dias_trabajados, extraConvenio: p.extra_convenio, extraBeneficio: p.extra_beneficio,
      arrastre: { dias: p.arrastre_dias, acuerdo: p.arrastre_acuerdo, origen: p.arrastre_origen },
      remuneracionRef: verSueldos ? p.remuneracion_ref : null, conyugeId: p.conyuge_id, hijosPrimaria: p.hijos_primaria,
      historial: json(p.historial, {}),
    } satisfies PerfilVac])),
    areas: Object.fromEntries(areas.map((a) => [a.id, {
      id: a.id, nombre: a.nombre, organigramaId: a.organigrama_id, color: a.color, jefeId: a.jefe_id,
      segundoId: a.vacaciones?.segundo_id ?? null, cupo: a.vacaciones?.cupo ?? null,
      semanas: json(a.vacaciones?.semanas, {}), reglas: json(a.vacaciones?.reglas, []), nota: a.vacaciones?.nota ?? '',
    } satisfies AreaVac])),
    solicitudes: Object.fromEntries(sols.map((s) => [s.empleado_id, solicitudDeFila(s)])),
  };
}

// ─── Escritura ──────────────────────────────────────────────────────────────

/**
 * Serializa las escrituras del módulo: el cupo de un área y las reglas de cobertura dependen de
 * lo que guardan los demás, así que dos envíos simultáneos no pueden validarse contra la misma foto.
 * ponytail: candado global del módulo; alcanza para cientos de personas. Por área si hiciera falta.
 */
function conCandado<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('vacaciones'))`;
    return fn(tx);
  }, { timeout: 20_000 });
}

const jsonONulo = (v: unknown) => (v == null ? Prisma.DbNull : (v as Prisma.InputJsonValue));

async function guardarSolicitud(tx: Prisma.TransactionClient, empleadoId: number, ejercicio: number, sol: Solicitud, por: string) {
  const data = {
    estado: sol.estado, tramos: sol.tramos as unknown as Prisma.InputJsonValue, enviada: sol.enviada,
    motivo: sol.motivo, acuerdo_fracc: jsonONulo(sol.acuerdoFracc), notificacion: jsonONulo(sol.notificacion),
    interrupciones: sol.interrupciones as unknown as Prisma.InputJsonValue, autoriza_fuera_termino: sol.autorizaFueraTermino,
    updated_by: por,
  };
  await tx.vacacionesSolicitud.upsert({
    where: { empleado_id_ejercicio: { empleado_id: empleadoId, ejercicio } },
    create: { empleado_id: empleadoId, ejercicio, ...data },
    update: data,
  });
}

async function registrar(db: Db, E: EstadoVac, actor: Actor, accion: string, empleadoId: number | null, detalle: string) {
  await db.vacacionesAuditoria.create({
    data: {
      fecha: E.hoy, ejercicio: E.config.ejercicio, actor: actor.nombre, usuario: actor.usuario, accion,
      empleado_id: empleadoId, persona: empleadoId != null ? nombreDe(E, empleadoId) : '', detalle: detalle.slice(0, 1000),
      ip: actor.ip,
    },
  });
}

// ─── Parseo de entradas (frontera de confianza) ─────────────────────────────

/** `aaaa-mm-dd` de un día que existe (el formato solo deja pasar un 30 de febrero). */
const fecha = (v: unknown, nombre: string): string => {
  if (typeof v !== 'string' || !FECHA_RE.test(v)) throw new VacacionesError(`${nombre}: fecha inválida (aaaa-mm-dd)`);
  const d = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || !d.toISOString().startsWith(v)) throw new VacacionesError(`${nombre}: ese día no existe`);
  return v;
};
/** Ids de Postgres (`int4`). */
const ID_MAX = 2_147_483_647;
export const idEntero = (v: unknown, nombre = 'id'): number => entero(v, nombre, 1, ID_MAX);
export const entero = (v: unknown, nombre: string, min: number, max: number): number => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) throw new VacacionesError(`${nombre}: tiene que ser un entero entre ${min} y ${max}`);
  return n;
};
const enteroONulo = (v: unknown, nombre: string, min: number, max: number) => (v == null || v === '' ? null : entero(v, nombre, min, max));
const booleano = (v: unknown, nombre: string): boolean => {
  if (typeof v !== 'boolean') throw new VacacionesError(`${nombre}: tiene que ser true o false`);
  return v;
};
const texto = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Lo que la persona y RRHH pueden hacer con una selección. `retirar` es solo de la persona (RRHH «reabre»). */
const ACCIONES_COMUNES = ['agregarTramo', 'reprogramar', 'quitarTramo', 'conformidad', 'enviar', 'acusar'] as const;
const ACCIONES: Record<ModoAccion, readonly string[]> = {
  portal: [...ACCIONES_COMUNES, 'retirar'],
  rrhh: [...ACCIONES_COMUNES, 'aprobar', 'devolver', 'reabrir', 'notificar', 'interrumpir', 'aprobarReprog', 'autorizar', 'permutar'],
};
type ModoAccion = 'portal' | 'rrhh';

// ─── Acciones sobre una solicitud ───────────────────────────────────────────

/** Aplica una acción a la selección de `empleadoId`, la guarda y la registra. */
async function ejecutarAccion(empleadoId: number, body: Record<string, unknown>, actor: Actor, modo: ModoAccion): Promise<void> {
  const accion = String(body.accion ?? '');
  if (!ACCIONES[modo].includes(accion)) throw new VacacionesError('Acción inválida', 400);

  await conCandado(async (tx) => {
    const E = await cargarEstado(tx);
    if (!empById(E, empleadoId)) throw new VacacionesError(FICHA_INACTIVA, 404);

    if (accion === 'permutar') {
      const con = idEntero(body.con, 'con');
      const r = permutar(E, empleadoId, con);
      if (!r.ok) throw new VacacionesError(r.error, 409);
      await guardarSolicitud(tx, empleadoId, E.config.ejercicio, r.solA, actor.nombre);
      await guardarSolicitud(tx, con, E.config.ejercicio, r.solB, actor.nombre);
      await registrar(tx, E, actor, 'Permuta de fechas', empleadoId, `con ${nombreDe(E, con)}`);
      await registrar(tx, E, actor, 'Permuta de fechas', con, `con ${nombreDe(E, empleadoId)}`);
      return;
    }

    let r: Resultado;
    switch (accion) {
      case 'agregarTramo':
      case 'reprogramar':
        r = agregarTramo(E, empleadoId, fecha(body.desde, 'Primer día'), entero(body.dias, 'Días', 1, MAX_DIAS_TRAMO),
          { fueraAcuerdo: body.fueraAcuerdo === true, reprog: accion === 'reprogramar' }, actor.nombre);
        break;
      case 'quitarTramo': r = quitarTramo(E, empleadoId, fecha(body.desde, 'Tramo')); break;
      case 'conformidad':
        r = conformidadFraccionamiento(E, empleadoId, booleano(body.acepta, 'acepta'), actor.nombre, modo === 'portal' ? 'portal' : 'papel');
        break;
      case 'enviar': r = enviar(E, empleadoId); break;
      // La persona puede retirar un envío que todavía nadie aprobó.
      case 'retirar':
        r = E.solicitudes[empleadoId]?.estado === 'enviada'
          ? reabrir(E, empleadoId, 'Retirada por la persona', false)
          : { ok: false, error: 'Solo se puede retirar una selección enviada que todavía no se aprobó.' };
        break;
      case 'acusar': r = acusarRecibo(E, empleadoId, modo === 'portal' ? `${actor.nombre} (portal)` : `${actor.nombre} (en papel)`); break;
      case 'aprobar': r = aprobar(E, empleadoId); break;
      case 'devolver': r = devolver(E, empleadoId, texto(body.motivo, 500)); break;
      case 'reabrir': r = reabrir(E, empleadoId, texto(body.motivo, 500), body.mutuoAcuerdo === true); break;
      case 'notificar': r = notificar(E, empleadoId, actor.nombre); break;
      case 'interrumpir':
        r = interrumpir(E, empleadoId, {
          tramoDesde: fecha(body.tramoDesde, 'Tramo'), desde: fecha(body.desde, 'Desde'), hasta: fecha(body.hasta, 'Hasta'),
          motivo: String(body.motivo ?? ''), certificado: texto(body.certificado, 120), informada: body.informada === true,
        }, actor.nombre);
        break;
      case 'aprobarReprog': r = aprobarReprogramacion(E, empleadoId, fecha(body.desde, 'Tramo')); break;
      case 'autorizar': r = autorizarFueraTermino(E, empleadoId); break;
      default: throw new VacacionesError('Acción inválida', 400);
    }
    if (!r.ok) throw new VacacionesError(modo === 'portal' ? r.errorPortal ?? r.error : r.error, 409);
    await guardarSolicitud(tx, empleadoId, E.config.ejercicio, r.sol, actor.nombre);
    await registrar(tx, E, actor, r.accion, empleadoId, r.detalle);
  });
}

/**
 * Valida un tramo sin guardarlo (vista previa mientras se elige la fecha). En el portal, los
 * mensajes no nombran a otras personas ni sus fechas (`paraPortal`).
 * ponytail: relee la temporada entera en cada consulta; cachear la foto unos segundos si pesa.
 */
export async function previsualizar(empleadoId: number, body: Record<string, unknown>, modo: ModoAccion): Promise<{ flags: Flag[] }> {
  const E = await cargarEstado(prisma, false);
  const desde = fecha(body.desde, 'Primer día'), dias = entero(body.dias, 'Días', 1, MAX_DIAS_TRAMO);
  const flags = validarTramo(E, empleadoId, desde, dias, undefined, { fueraAcuerdo: body.fueraAcuerdo === true, reprog: body.reprog === true });
  return { flags: modo === 'portal' ? flags.map(paraPortal) : flags };
}

/** Primera fecha libre para un bloque de `dias` (si no hay, prueba con el tramo mínimo). */
export async function sugerir(empleadoId: number, diasPedidos: unknown): Promise<{ desde: string | null; dias: number }> {
  const E = await cargarEstado(prisma, false);
  let dias = entero(diasPedidos, 'Días', 1, MAX_DIAS_TRAMO);
  let desde = sugerirInicio(E, empleadoId, dias);
  if (!desde && dias > E.config.tramoMinimo) {
    dias = E.config.tramoMinimo;
    desde = sugerirInicio(E, empleadoId, dias);
  }
  return { desde, dias };
}

export type VistaRespuesta = VistaSeleccion & { empleador: { nombre: string; cuit: string } | null };

/** Selección de una persona, lista para el editor (Mis vacaciones o la carga de RRHH). */
export async function vista(empleadoId: number, modo: ModoAccion): Promise<VistaRespuesta> {
  const E = await cargarEstado(prisma, false);
  const v = vistaSeleccion(E, empleadoId);
  if (!v) throw new VacacionesError(modo === 'portal' ? 'Tu ficha no está activa en el organigrama' : FICHA_INACTIVA, 404);
  const n = await prisma.nominaEmpleado.findUnique({ where: { empleado_id: empleadoId }, select: { cuil: true } });
  const empleador = n?.cuil ? await empleadorPorCuil(n.cuil) : null;
  if (modo === 'rrhh') return { ...v, empleador };
  // En el portal no se muestran fechas ni nombres de otras personas (reglas de cobertura).
  return { ...v, validacion: v.validacion.map(paraPortal), empleador };
}

/** POST de una selección: `validar` y `sugerir` no guardan; el resto aplica la acción y devuelve la vista nueva. */
export async function postSeleccion(empleadoId: number, body: Record<string, unknown>, actor: Actor, modo: ModoAccion) {
  if (body.accion === 'validar') return previsualizar(empleadoId, body, modo);
  if (body.accion === 'sugerir') return sugerir(empleadoId, body.dias);
  await ejecutarAccion(empleadoId, body, actor, modo);
  return vista(empleadoId, modo);
}

// ─── Parámetros ─────────────────────────────────────────────────────────────

function validarConvenios(v: unknown): Record<string, Convenio> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new VacacionesError('Convenios inválidos');
  const out: Record<string, Convenio> = {};
  for (const [codigo, raw] of Object.entries(v as Record<string, Record<string, unknown>>)) {
    if (!/^[A-Z0-9]{2,12}$/.test(codigo)) throw new VacacionesError(`Código de convenio inválido: ${codigo}`);
    const mes = entero(raw.corteMes, `${codigo} · mes de corte`, 1, 12);
    const diasMes = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1];
    out[codigo] = {
      nombre: texto(raw.nombre, 80) || codigo,
      corteDia: entero(raw.corteDia, `${codigo} · día de corte`, 1, diasMes),
      corteMes: mes,
      corteAnioOffset: entero(raw.corteAnioOffset, `${codigo} · años de corte`, 0, 1),
      maxTramos: entero(raw.maxTramos, `${codigo} · tramos`, 1, 6),
      avisoDias: entero(raw.avisoDias, `${codigo} · aviso`, 30, 120),
      conyuges: booleano(raw.conyuges, `${codigo} · cónyuges`),
      permutas: booleano(raw.permutas, `${codigo} · permutas`),
      suspFallecimiento: booleano(raw.suspFallecimiento, `${codigo} · fallecimiento`),
      hijosEscolares: booleano(raw.hijosEscolares, `${codigo} · hijos escolares`),
      remuneracion: raw.remuneracion === 'mayor12' ? 'mayor12' : 'actual',
    };
  }
  if (!out.LCT) throw new VacacionesError('El convenio LCT (fuera de convenio) no se puede quitar');
  return out;
}

/**
 * Valida un cambio de parámetros. El aviso mínimo no baja de 30 días (art. 154) y el tramo
 * mínimo no baja de 7: la empresa puede ser más exigente que la ley, nunca menos.
 */
function validarPatchConfig(p: Record<string, unknown>): Partial<ConfigVacaciones> {
  const out: Partial<ConfigVacaciones> = {};
  for (const k of ['temporadaDesde', 'temporadaHasta', 'inicioProceso', 'fechaLimiteCarga'] as const) {
    if (k in p) out[k] = fecha(p[k], k);
  }
  for (const k of ['veranoInicio', 'veranoFin'] as const) {
    if (k in p) {
      if (typeof p[k] !== 'string' || !MMDD_RE.test(p[k] as string)) throw new VacacionesError(`${k}: formato MM-DD`);
      out[k] = p[k] as string;
    }
  }
  const nums = {
    ejercicio: [2000, 2100], cicloVerano: [2, 5], avisoMinimoDias: [30, 120], personasPorTurno: [1, 100],
    diasPorTurno: [0, 30], tramoMinimo: [7, 35], maxTramos: [1, 6], tramoPrincipalPct: [0, 100],
  } as const;
  for (const [k, [min, max]] of Object.entries(nums) as [keyof typeof nums, readonly [number, number]][]) {
    if (k in p) out[k] = entero(p[k], k, min, max);
  }
  if ('criterioOrden' in p) {
    if (!Object.hasOwn(CRITERIOS_ORDEN, String(p.criterioOrden))) throw new VacacionesError('Criterio de orden inválido');
    out.criterioOrden = p.criterioOrden as ConfigVacaciones['criterioOrden'];
  }
  if ('semillaSorteo' in p) out.semillaSorteo = texto(p.semillaSorteo, 40) || '0';
  if ('fraccionar' in p) out.fraccionar = booleano(p.fraccionar, 'fraccionar');
  if ('feriados' in p) {
    if (!Array.isArray(p.feriados)) throw new VacacionesError('feriados: tiene que ser una lista');
    out.feriados = [...new Set(p.feriados.map((f) => fecha(f, 'Feriado')))].sort();
  }
  if ('cierres' in p) {
    if (!Array.isArray(p.cierres)) throw new VacacionesError('cierres: tiene que ser una lista');
    out.cierres = p.cierres.map((c: Record<string, unknown>) => {
      const desde = fecha(c?.desde, 'Cierre desde'), hasta = fecha(c?.hasta, 'Cierre hasta');
      if (hasta < desde) throw new VacacionesError('Un cierre colectivo termina antes de empezar');
      return { nombre: texto(c?.nombre, 60) || 'Cierre colectivo', desde, hasta };
    });
  }
  if ('convenios' in p) out.convenios = validarConvenios(p.convenios);
  return out;
}

async function guardarParams(db: Db, params: ConfigVacaciones, actor: Actor) {
  const data = { params: params as unknown as Prisma.InputJsonValue, updated_by: actor.usuario };
  await db.vacacionesConfig.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
}

export async function guardarConfig(patch: Record<string, unknown>, actor: Actor): Promise<ConfigVacaciones> {
  const cambios = validarPatchConfig(patch);
  if (!Object.keys(cambios).length) throw new VacacionesError('No hay cambios');
  return conCandado(async (tx) => {
    const actual = await leerConfig(tx);
    const nueva = { ...actual, ...cambios };
    if (nueva.temporadaHasta <= nueva.temporadaDesde) throw new VacacionesError('La temporada tiene que cerrar después de abrir');
    await guardarParams(tx, nueva, actor);
    const E: EstadoVac = { hoy: hoyLocal(), config: nueva, empleados: [], perfiles: {}, areas: {}, solicitudes: {} };
    const detalle = Object.keys(cambios).map((k) => {
      const v = cambios[k as keyof ConfigVacaciones];
      return `${k} = ${typeof v === 'object' ? JSON.stringify(v).slice(0, 200) : v}`;
    }).join(' · ');
    await registrar(tx, E, actor, 'Parámetros modificados', null, detalle);
    return nueva;
  });
}

// ─── Ficha de vacaciones de una persona ─────────────────────────────────────

export async function guardarPerfil(empleadoId: number, p: Record<string, unknown>, actor: Actor, verSueldos: boolean): Promise<void> {
  await conCandado(async (tx) => {
    const E = await cargarEstado(tx);
    if (!empById(E, empleadoId)) throw new VacacionesError(FICHA_INACTIVA, 404);
    const d: Prisma.VacacionesPerfilUncheckedUpdateInput = {};
    if ('incluir' in p) d.incluir = booleano(p.incluir, 'Participa');
    if ('convenio' in p) {
      if (p.convenio != null && p.convenio !== '' && !existeConvenio(E, String(p.convenio))) throw new VacacionesError('Convenio inexistente');
      d.convenio = p.convenio ? String(p.convenio) : null;
    }
    if ('francoRotativo' in p) d.franco_rotativo = booleano(p.francoRotativo, 'Francos rotativos');
    if ('diaDescanso' in p) d.dia_descanso = entero(p.diaDescanso, 'Día de descanso', 0, 6);
    if ('diasTrabajados' in p) d.dias_trabajados = enteroONulo(p.diasTrabajados, 'Días trabajados', 0, 366);
    if ('extraConvenio' in p) d.extra_convenio = entero(p.extraConvenio, 'Extra por convenio', 0, MAX_DIAS_TRAMO);
    if ('extraBeneficio' in p) d.extra_beneficio = entero(p.extraBeneficio, 'Extra por beneficio', 0, MAX_DIAS_TRAMO);
    if ('arrastreDias' in p) d.arrastre_dias = entero(p.arrastreDias, 'Arrastre', 0, MAX_DIAS_TRAMO);
    if ('arrastreAcuerdo' in p) d.arrastre_acuerdo = booleano(p.arrastreAcuerdo, 'Acuerdo de acumulación');
    if ('hijosPrimaria' in p) d.hijos_primaria = booleano(p.hijosPrimaria, 'Hijos en primaria');
    if ('conyugeId' in p) {
      const c = enteroONulo(p.conyugeId, 'Cónyuge', 1, ID_MAX);
      if (c != null && (c === empleadoId || !empById(E, c))) throw new VacacionesError('Cónyuge inválido');
      d.conyuge_id = c;
    }
    if ('remuneracionRef' in p) {
      if (!verSueldos) throw new VacacionesError('La remuneración la carga quien tiene acceso a Nómina', 403);
      const v = p.remuneracionRef === '' || p.remuneracionRef == null ? null : Number(p.remuneracionRef);
      if (v != null && (!Number.isFinite(v) || v < 0)) throw new VacacionesError('Remuneración inválida');
      d.remuneracion_ref = v;
    }
    if ('historial' in p) {
      const h = p.historial;
      if (!h || typeof h !== 'object' || Array.isArray(h)) throw new VacacionesError('Historial inválido');
      const limpio: Record<string, { verano: boolean | null; pos: number | null }> = {};
      for (const [anio, x] of Object.entries(h as Record<string, Record<string, unknown>>)) {
        entero(anio, 'Temporada', 2000, 2100);
        const verano = x?.verano == null ? null : booleano(x.verano, 'Verano');
        const pos = enteroONulo(x?.pos, 'Turno', 0, 10_000);
        if (verano != null || pos != null) limpio[anio] = { verano, pos };
      }
      d.historial = limpio;
    }
    const campos = Object.keys(d);
    if (!campos.length) throw new VacacionesError('No hay cambios');
    await tx.vacacionesPerfil.upsert({
      where: { empleado_id: empleadoId },
      create: { ...(d as Prisma.VacacionesPerfilUncheckedCreateInput), empleado_id: empleadoId, updated_by: actor.usuario },
      update: { ...d, updated_by: actor.usuario },
    });
    await registrar(tx, E, actor, 'Ficha modificada', empleadoId, campos.join(', '));
  });
}

// ─── Cobertura de un área ───────────────────────────────────────────────────

export async function guardarArea(areaId: number, p: Record<string, unknown>, actor: Actor): Promise<void> {
  await conCandado(async (tx) => {
    const E = await cargarEstado(tx);
    const area = E.areas[areaId];
    if (!area) throw new VacacionesError('El área no existe', 404);
    const d: Prisma.VacacionesAreaUncheckedUpdateInput = {};
    if ('cupo' in p) d.cupo = enteroONulo(p.cupo, 'Cupo', 0, 99);
    if ('segundoId' in p) {
      const s = enteroONulo(p.segundoId, 'Segundo', 1, ID_MAX);
      if (s != null && !empById(E, s)) throw new VacacionesError('Esa persona no está activa');
      d.segundo_id = s;
    }
    if ('semanas' in p) {
      const s = p.semanas;
      if (!s || typeof s !== 'object' || Array.isArray(s)) throw new VacacionesError('Semanas inválidas');
      const limpio: Record<string, number> = {};
      for (const [lunes, n] of Object.entries(s as Record<string, unknown>)) {
        if (new Date(`${fecha(lunes, 'Semana')}T00:00:00Z`).getUTCDay() !== 1) throw new VacacionesError('Cada semana se identifica por su lunes');
        limpio[lunes] = entero(n, 'Cupo de la semana', 0, 99);
      }
      d.semanas = limpio;
    }
    if ('reglas' in p) {
      if (!Array.isArray(p.reglas)) throw new VacacionesError('Reglas inválidas');
      const reglas: ReglaCobertura[] = p.reglas.map((x: Record<string, unknown>) => {
        const ids: unknown = x?.ids;
        const r = {
          // El tipo pasa tal cual: `errorRegla` rechaza el que no existe.
          tipo: String(x?.tipo) as ReglaCobertura['tipo'],
          nombre: texto(x?.nombre, 60),
          // Solo personas activas: una que ya no está no puede contar como presente.
          ids: Array.isArray(ids) ? [...new Set(ids.map(Number))].filter((n) => Number.isInteger(n) && empById(E, n)) : [],
          min: x?.tipo === 'minimo' ? Number(x?.min) : undefined,
        };
        const error = errorRegla(E, r);
        if (error) throw new VacacionesError(`Regla «${r.nombre || 'sin nombre'}»: ${error}`);
        return r;
      });
      d.reglas = reglas as unknown as Prisma.InputJsonValue;
    }
    if ('nota' in p) d.nota = texto(p.nota, 300);
    const campos = Object.keys(d);
    if (!campos.length) throw new VacacionesError('No hay cambios');
    await tx.vacacionesArea.upsert({
      where: { area_id: areaId },
      create: { ...(d as Prisma.VacacionesAreaUncheckedCreateInput), area_id: areaId, updated_by: actor.usuario },
      update: { ...d, updated_by: actor.usuario },
    });
    await registrar(tx, E, actor, 'Área modificada', null, `${area.nombre}: ${campos.join(', ')}`);
  });
}

// ─── Cierre de temporada ────────────────────────────────────────────────────

/**
 * `ejercicio` es la temporada que la pantalla quiere cerrar: un segundo POST (doble clic, reintento)
 * llega con el ejercicio ya cerrado y se rechaza, en vez de avanzar otro año sin deshacer.
 */
export async function cerrarTemporadaActual(ejercicio: number, actor: Actor) {
  return conCandado(async (tx) => {
    const E = await cargarEstado(tx);
    if (E.config.ejercicio !== ejercicio) throw new VacacionesError(`La temporada ${ejercicio} ya está cerrada`, 409);
    const r = cerrarTemporada(E);
    for (const [id, x] of Object.entries(r.perfiles)) {
      const data = {
        historial: x.historial as unknown as Prisma.InputJsonValue,
        arrastre_dias: x.arrastre.dias, arrastre_acuerdo: false, arrastre_origen: x.arrastre.origen, updated_by: actor.usuario,
      };
      await tx.vacacionesPerfil.upsert({ where: { empleado_id: Number(id) }, create: { empleado_id: Number(id), ...data }, update: data });
    }
    await guardarParams(tx, r.config, actor);
    await registrar(tx, E, actor, 'Temporada cerrada', null,
      `${E.config.ejercicio} · ${r.resumen.personas} personas · ${r.resumen.conVerano} con verano · ${r.resumen.arrastres} con arrastre propuesto`);
    return r.resumen;
  });
}

// ─── Auditoría ──────────────────────────────────────────────────────────────

export async function listarAuditoria(empleadoId: number | null) {
  return prisma.vacacionesAuditoria.findMany({
    where: empleadoId ? { empleado_id: empleadoId } : {},
    orderBy: { id: 'desc' },
    take: MAX_FILAS_AUDITORIA,
  });
}
