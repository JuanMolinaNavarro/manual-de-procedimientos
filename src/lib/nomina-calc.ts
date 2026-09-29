/**
 * Nómina — motor de cálculo y helpers puros, compartidos cliente ↔ servidor.
 * Sin Prisma, sin React, sin crypto: el hash vive en `nomina-hash.ts`.
 *
 * El motor es el del prototipo PayRoll Assistant, ya testeado: liquida un
 * empleado a partir de Maestro + Novedades + Parámetros + Conceptos y del
 * último período cerrado (para la alerta de variación).
 */

import { mesLocal } from './fechas';
import {
  RUBROS_EMPLEADOR,
  type Bono,
  type Concepto,
  type Empresa,
  type Maestro,
  type Novedad,
  type Params,
} from './nomina-datos';

// ─── Tipos ───────────────────────────────────────────────────────────────────

/** Lo que la nómina necesita de una ficha del organigrama. */
export interface EmpleadoNomina {
  id: number;
  nombre: string;
  rol: string;
  area: string;
  estado: string;
  foto_archivo: string | null;
}

export interface Item { nombre: string; monto: number; detalle: string }
export interface Contrib { rubro: string; nombre: string; pct: number; base: number; monto: number }
export interface Flag { tipo: 'error' | 'warn'; msg: string }

export interface Liquidacion {
  empId: number;
  nombre: string;
  rol: string;
  dept: string;
  rem: Item[];
  norem: Item[];
  ded: Item[];
  contribs: Contrib[];
  totalContrib: number;
  totalRem: number;
  totalNoRem: number;
  totalDed: number;
  neto: number;
  costoEmpresa: number;
  flags: Flag[];
  anios: number;
  basico: number;
}

/** Netos del último período cerrado anterior, para la alerta de variación. */
export interface LiqAnterior { periodo: string; netos: Record<number, number> }

// ─── Utilidades ──────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });
export function money(n: number | null | undefined): string {
  return fmt.format(Math.round((n || 0) * 100) / 100);
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export function periodLabel(p: string): string {
  const [y, m] = p.split('-');
  return `${MESES[+m - 1] ?? m} ${y}`;
}

/** Período actual en formato YYYY-MM. */
export function periodoActual(): string {
  return mesLocal();
}

export function aniosAntiguedad(fechaIngreso: string, periodo: string): number {
  if (!fechaIngreso) return 0;
  const fi = new Date(fechaIngreso + 'T00:00:00');
  const fin = new Date(periodo + '-28T00:00:00');
  if (isNaN(fi.getTime())) return 0;
  return Math.max(0, Math.floor((fin.getTime() - fi.getTime()) / (365.25 * 24 * 3600 * 1000)));
}

export function contribTotalPct(params: Params): number {
  return RUBROS_EMPLEADOR.reduce((s, r) => s + (+params[r[2]] || 0), 0);
}

export function montoConcepto(c: Pick<Concepto, 'calculo' | 'valor'>, basico: number, totalRem: number): number {
  if (c.calculo === 'pct_basico') return basico * (+c.valor || 0) / 100;
  if (c.calculo === 'pct_rem') return totalRem * (+c.valor || 0) / 100;
  return +c.valor || 0;
}

export function etiquetaConcepto(c: Pick<Concepto, 'calculo' | 'valor'>): string {
  if (c.calculo === 'pct_basico') return `${c.valor}% s/ básico`;
  if (c.calculo === 'pct_rem') return `${c.valor}% s/ remunerativo`;
  return 'monto fijo';
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ─── Motor ───────────────────────────────────────────────────────────────────

export interface LiquidarInput {
  empleado: EmpleadoNomina;
  maestro: Maestro;
  novedad: Novedad;
  params: Params;
  conceptos: Concepto[];
  periodo: string;
  liqAnterior: LiqAnterior | null;
}

export function liquidarEmpleado(i: LiquidarInput): Liquidacion {
  const { empleado: e, maestro: m, novedad: nov, params, conceptos, periodo } = i;
  const basico = +m.basico || 0;
  const valorDia = basico / 30;
  const valorHora = basico / (params.divisorHora || 200);
  const anios = aniosAntiguedad(m.fechaIngreso, periodo);

  const rem: Item[] = [], norem: Item[] = [], ded: Item[] = [];
  const add = (arr: Item[], nombre: string, monto: number, detalle?: string) => {
    if (Math.abs(monto) > 0.004) arr.push({ nombre, monto: round2(monto), detalle: detalle || '' });
  };

  const diasDesc = (+nov.faltasInj || 0) + (+nov.diasSinGoce || 0);
  add(rem, 'Sueldo básico', basico - diasDesc * valorDia, diasDesc > 0 ? `30 − ${diasDesc} día(s) no trabajados` : 'mes completo');
  const antig = basico * (params.antiguedadAnio / 100) * anios;
  add(rem, 'Antigüedad', antig, `${anios} año(s) × ${params.antiguedadAnio}%`);
  if (params.presentismo > 0 && (+nov.faltasInj || 0) === 0) {
    add(rem, 'Presentismo', (basico + antig) * params.presentismo / 100, `${params.presentismo}% (sin faltas injustificadas)`);
  }
  add(rem, 'Horas extra 50%', (+nov.he50 || 0) * valorHora * 1.5, `${nov.he50} hs × ${money(valorHora * 1.5)}`);
  add(rem, 'Horas extra 100%', (+nov.he100 || 0) * valorHora * 2, `${nov.he100} hs × ${money(valorHora * 2)}`);
  if ((+nov.diasVacaciones || 0) > 0) {
    const plus = nov.diasVacaciones * (basico / (params.divisorVacaciones || 25) - basico / 30);
    add(rem, 'Plus vacacional', plus, `${nov.diasVacaciones} día(s) (÷${params.divisorVacaciones} vs ÷30)`);
  }
  add(rem, 'Comisiones', +nov.comisiones || 0, 'novedad del mes');
  add(rem, 'Premios / bonos', +nov.premios || 0, 'novedad del mes');
  add(rem, 'SAC', +nov.sac || 0, 'aguinaldo (carga manual)');
  conceptos.filter((c) => c.activo && c.tipo === 'rem').forEach((c) => {
    add(rem, c.nombre, montoConcepto(c, basico, 0), etiquetaConcepto(c));
  });
  const totalRem = rem.reduce((s, x) => s + x.monto, 0);

  add(norem, 'Asignaciones familiares', +nov.asigFamiliares || 0, 'según cargas declaradas');
  conceptos.filter((c) => c.activo && c.tipo === 'norem').forEach((c) => {
    add(norem, c.nombre, montoConcepto(c, basico, totalRem), etiquetaConcepto(c));
  });
  const totalNoRem = norem.reduce((s, x) => s + x.monto, 0);

  add(ded, 'Jubilación', totalRem * params.jubilacion / 100, `${params.jubilacion}% s/ remunerativo`);
  add(ded, 'Ley 19.032 (PAMI)', totalRem * params.ley19032 / 100, `${params.ley19032}% s/ remunerativo`);
  add(ded, 'Obra social', totalRem * params.obraSocial / 100, `${params.obraSocial}% s/ remunerativo`);
  if (m.afiliado) add(ded, 'Cuota sindical', totalRem * params.sindicato / 100, `${params.sindicato}% (afiliado)`);
  add(ded, 'Imp. a las Ganancias', +nov.ganancias || 0, 'retención calculada (carga manual)');
  add(ded, 'Adelantos de sueldo', +nov.adelantos || 0, 'novedad del mes');
  add(ded, 'Embargos', +nov.embargos || 0, 'orden judicial');
  conceptos.filter((c) => c.activo && c.tipo === 'ded').forEach((c) => {
    add(ded, c.nombre, montoConcepto(c, basico, totalRem), etiquetaConcepto(c));
  });
  const totalDed = ded.reduce((s, x) => s + x.monto, 0);

  const neto = totalRem - totalDed + totalNoRem;
  // Contribuciones a cargo del empleador, por rubro (base: remunerativo)
  const contribs: Contrib[] = RUBROS_EMPLEADOR.map(([rubro, nombre, key]) => {
    const pct = +params[key] || 0;
    return { rubro, nombre, pct, base: totalRem, monto: Math.round(totalRem * pct) / 100 };
  }).filter((c) => c.monto > 0);
  const totalContrib = contribs.reduce((s, c) => s + c.monto, 0);
  const costoEmpresa = totalRem + totalContrib + totalNoRem;

  const flags: Flag[] = [];
  if (!m.basico || +m.basico <= 0) flags.push({ tipo: 'error', msg: 'Sin sueldo básico cargado en el Maestro' });
  if (!m.cuil) flags.push({ tipo: 'warn', msg: 'Falta CUIL en el Maestro' });
  if (!m.fechaIngreso) flags.push({ tipo: 'warn', msg: 'Falta fecha de ingreso (la antigüedad calcula 0)' });
  if (neto <= 0 && totalRem > 0) flags.push({ tipo: 'error', msg: 'El neto da cero o negativo' });
  if (totalRem > 0 && totalDed / totalRem * 100 > params.topeDeducciones + 17) {
    flags.push({ tipo: 'warn', msg: `Deducciones altas: ${(totalDed / totalRem * 100).toFixed(1)}% del bruto` });
  }
  const prev = i.liqAnterior;
  if (prev) {
    const prevNeto = prev.netos[e.id];
    if (prevNeto !== undefined && prevNeto > 0 && neto > 0) {
      const varPct = (neto - prevNeto) / prevNeto * 100;
      if (Math.abs(varPct) > params.alertaVariacion) {
        flags.push({ tipo: 'warn', msg: `Variación de ${varPct > 0 ? '+' : ''}${varPct.toFixed(1)}% vs ${periodLabel(prev.periodo)}` });
      }
    }
  }

  return {
    empId: e.id, nombre: e.nombre, rol: e.rol, dept: e.area,
    rem, norem, ded, contribs, totalContrib, totalRem, totalNoRem, totalDed, neto, costoEmpresa, flags, anios, basico,
  };
}

// ─── Importe en letras (art. 140 inc. g) ─────────────────────────────────────

export function numeroALetras(n: number): string {
  const U = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
  const D = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  const C = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
  const tresCifras = (x: number): string => {
    if (x === 0) return '';
    if (x === 100) return 'cien';
    const c = Math.floor(x / 100), r = x % 100;
    let s = C[c];
    if (r) s += (s ? ' ' : '') + (r < 30 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? ' y ' + U[r % 10] : ''));
    return s;
  };
  const entero = (x: number): string => {
    if (x === 0) return 'cero';
    let s = '';
    const mill = Math.floor(x / 1e6), miles = Math.floor((x % 1e6) / 1e3), resto = x % 1e3;
    if (mill) s += mill === 1 ? 'un millón' : entero(mill) + ' millones';
    if (miles) s += (s ? ' ' : '') + (miles === 1 ? 'mil' : tresCifras(miles) + ' mil');
    if (resto) s += (s ? ' ' : '') + tresCifras(resto);
    return s;
  };
  const abs = Math.abs(Math.round((n || 0) * 100) / 100);
  const ent = Math.floor(abs), cent = Math.round((abs - ent) * 100);
  return `pesos ${entero(ent)} con ${String(cent).padStart(2, '0')}/100`;
}

// ─── Recibo: metadatos y contenido canónico ──────────────────────────────────

/** Datos del Maestro que se congelan en el cierre por empleado. */
export interface MaestroSnapshot {
  cuil: string;
  categoria: string;
  convenio: string;
  cct: string;
  fechaIngreso: string;
  cbu: string;
}

export function maestroSnapshot(m: Maestro): MaestroSnapshot {
  return {
    cuil: m.cuil || '', categoria: m.categoria || '', convenio: m.convenio || '',
    cct: m.cct || '', fechaIngreso: m.fechaIngreso || '', cbu: m.cbu || '',
  };
}

export interface ReciboMeta {
  empresa: { razonSocial: string; cuit: string; domicilio: string };
  trabajador: {
    nombre: string; cuil: string; categoria: string; convenio: string; cct: string;
    fechaIngreso: string; antiguedad: number; cbu: string;
  };
  periodo: string;
  cargasSociales: { lugarPago: string; banco: string; ultimoDepositoFecha: string; ultimoDepositoPeriodo: string };
}

/**
 * Identificación que viaja con cada recibo (sección 1). En períodos cerrados se
 * llama con los snapshots del cierre, así el hash firmado sigue verificando
 * aunque cambien Parámetros o Maestro después.
 */
export function reciboMeta(l: Liquidacion, empresa: Empresa, m: MaestroSnapshot, periodo: string): ReciboMeta {
  return {
    empresa: { razonSocial: empresa.razonSocial || '', cuit: empresa.cuit || '', domicilio: empresa.domicilio || '' },
    trabajador: {
      nombre: l.nombre, cuil: m.cuil || '', categoria: m.categoria || '', convenio: m.convenio || '',
      cct: m.cct || empresa.cctDefault || '', fechaIngreso: m.fechaIngreso || '', antiguedad: l.anios, cbu: m.cbu || '',
    },
    periodo,
    cargasSociales: {
      lugarPago: empresa.lugarPagoCargas || '', banco: empresa.bancoDepositos || '',
      ultimoDepositoFecha: empresa.ultimoDepositoFecha || '', ultimoDepositoPeriodo: empresa.ultimoDepositoPeriodo || '',
    },
  };
}

export interface ReciboPayload {
  version: 'anexoIII-1';
  periodo: string;
  fechaCierre: string | null;
  empresa: ReciboMeta['empresa'];
  trabajador: ReciboMeta['trabajador'];
  cargasSociales: ReciboMeta['cargasSociales'];
  contribs: { rubro: string; nombre: string; pct: number; monto: number }[];
  totalContrib: number;
  rem: Item[];
  norem: Item[];
  ded: Item[];
  totalRem: number;
  totalNoRem: number;
  totalDed: number;
  neto: number;
  costoEmpresa: number;
}

/**
 * Contenido canónico que se firma: todo lo que ve el empleado, sin nada
 * volátil. Cada objeto anidado se reconstruye explícitamente para que el
 * payload no dependa de claves extra que pudieran venir del snapshot.
 */
export function reciboPayload(l: Liquidacion, meta: ReciboMeta, fechaCierre: string | null): ReciboPayload {
  const item = (x: Item): Item => ({ nombre: x.nombre, monto: x.monto, detalle: x.detalle || '' });
  return {
    version: 'anexoIII-1',
    periodo: meta.periodo,
    fechaCierre: fechaCierre || null,
    empresa: { ...meta.empresa },
    trabajador: { ...meta.trabajador },
    cargasSociales: { ...meta.cargasSociales },
    contribs: (l.contribs || []).map((x) => ({ rubro: x.rubro, nombre: x.nombre, pct: x.pct, monto: x.monto })),
    totalContrib: l.totalContrib || 0,
    rem: l.rem.map(item), norem: l.norem.map(item), ded: l.ded.map(item),
    totalRem: l.totalRem, totalNoRem: l.totalNoRem, totalDed: l.totalDed, neto: l.neto, costoEmpresa: l.costoEmpresa,
  };
}

/**
 * JSON con claves ordenadas recursivamente. Es lo que se hashea: Postgres
 * (jsonb) no conserva el orden de las claves, así que el hash no puede
 * depender del orden de inserción.
 */
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return '[' + v.map(canonicalJson).join(',') + ']';
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o).filter((k) => o[k] !== undefined).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJson(o[k])).join(',') + '}';
}

// ─── Bonos (gamification) ────────────────────────────────────────────────────

export interface RankingRow {
  emp: EmpleadoNomina;
  valor: number;
  /** Solo para racha de presentismo: un punto por período, ok = sin faltas. */
  racha: { periodo: string; ok: boolean }[];
}

/** Períodos que cuentan para la racha: cerrados + el actual si está abierto (últimos 6). */
export function periodosRacha(cerrados: string[], periodo: string, cerrado: boolean): string[] {
  return [...cerrados].sort().concat(cerrado ? [] : [periodo]).slice(-6);
}

/** Ranking de un bono en un período, ordenado desc por valor y luego por nombre. */
export function rankingBono(
  b: Pick<Bono, 'ambito' | 'metrica'>,
  incluidos: EmpleadoNomina[],
  novPorPeriodo: Record<string, Record<number, Novedad>>,
  periodos: string[],
  periodo: string,
): RankingRow[] {
  const pool = b.ambito === 'empresa' ? incluidos : incluidos.filter((e) => e.area === b.ambito);
  const rows = pool.map((e) => {
    const nov = (novPorPeriodo[periodo] || {})[e.id];
    let valor = 0;
    let racha: RankingRow['racha'] = [];
    if (b.metrica === 'racha_presentismo') {
      let n = 0;
      for (let i = periodos.length - 1; i >= 0; i--) {
        const nv = (novPorPeriodo[periodos[i]] || {})[e.id];
        if (!nv || (+nv.faltasInj || 0) === 0) n++; else break;
      }
      valor = n;
      racha = periodos.map((p) => {
        const nv = (novPorPeriodo[p] || {})[e.id];
        return { periodo: p, ok: !nv || (+nv.faltasInj || 0) === 0 };
      });
    } else if (b.metrica === 'horas_extra') valor = (+(nov?.he50) || 0) + (+(nov?.he100) || 0);
    else if (b.metrica === 'comisiones') valor = +(nov?.comisiones) || 0;
    else if (b.metrica === 'premios') valor = +(nov?.premios) || 0;
    return { emp: e, valor, racha };
  });
  return rows.sort((a, c) => c.valor - a.valor || a.emp.nombre.localeCompare(c.emp.nombre));
}

export function descValorBono(metrica: Bono['metrica'], valor: number, periodo: string): string {
  if (metrica === 'racha_presentismo') return `${valor} mes(es) seguidos sin faltas injustificadas`;
  if (metrica === 'horas_extra') return `${valor} horas extra en ${periodLabel(periodo)}`;
  if (metrica === 'comisiones') return 'líder en resultados comerciales del período';
  return 'mayor reconocimiento por resultados del período';
}

// ─── Tablero y exportación ───────────────────────────────────────────────────

export interface PasosTablero {
  pasoMaestro: boolean;
  pasoNov: boolean;
  pasoVal: boolean;
  cerrado: boolean;
}

export function pasosTablero(i: { incluidos: number; maestroOk: number; novCount: number; errores: number; cerrado: boolean }): PasosTablero {
  const pasoMaestro = i.maestroOk === i.incluidos && i.incluidos > 0;
  const pasoNov = i.novCount > 0;
  const pasoVal = i.errores === 0 && pasoMaestro;
  return { pasoMaestro, pasoNov, pasoVal, cerrado: i.cerrado };
}

/** CSV para el contador: BOM + separador ';'. */
export function csvLiquidacion(periodo: string, liqs: Liquidacion[], cuilPorEmp: Record<number, string>): string {
  const head = ['Periodo', 'Empleado', 'CUIL', 'Rol', 'Area', 'Basico', 'Total Remunerativo', 'Total No Remunerativo', 'Total Deducciones', 'Neto', 'Costo Empresa'];
  const lines = [head.join(';')];
  liqs.forEach((l) => {
    lines.push([periodo, l.nombre, cuilPorEmp[l.empId] || '', l.rol, l.dept, l.basico, l.totalRem, l.totalNoRem, l.totalDed, l.neto, l.costoEmpresa]
      .map((v) => String(v).replace(/;/g, ',')).join(';'));
  });
  return String.fromCharCode(0xfeff) + lines.join('\n');
}

export function totalesLiquidacion(liqs: Liquidacion[]) {
  return {
    bruto: liqs.reduce((s, l) => s + l.totalRem, 0),
    deducciones: liqs.reduce((s, l) => s + l.totalDed, 0),
    noRem: liqs.reduce((s, l) => s + l.totalNoRem, 0),
    neto: liqs.reduce((s, l) => s + l.neto, 0),
    costo: liqs.reduce((s, l) => s + l.costoEmpresa, 0),
    errores: liqs.reduce((s, l) => s + l.flags.filter((f) => f.tipo === 'error').length, 0),
    avisos: liqs.reduce((s, l) => s + l.flags.filter((f) => f.tipo === 'warn').length, 0),
  };
}

export function iniciales(nombre: string): string {
  return nombre.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

/** Fecha ISO (datetime) formateada en es-AR; tolera vacío. */
export function fechaHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString('es-AR');
}

/** Fecha ISO yyyy-mm-dd → dd/mm/aaaa; tolera vacío. */
export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}
