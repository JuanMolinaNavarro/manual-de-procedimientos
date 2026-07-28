/**
 * Modelo financiero y de cronograma del módulo Proyectos y finanzas.
 *
 * Funciones puras (sin Prisma ni React): las usa el servidor para los listados
 * y el cliente para recalcular en vivo mientras se editan los supuestos.
 */

import { MESES_CORTOS } from './proyectos-datos';

// ─── Tipos compartidos (cliente ↔ servidor) ──────────────────────────────────

export interface CostoProyecto {
  id: number;
  categoria: string;
  concepto: string;
  unidad: string;
  cantidad: number;
  costo_unitario: number;
  moneda: string;
  etapa_id: number | null;
  orden: number;
}

export interface EtapaProyecto {
  id: number;
  nombre: string;
  /** Texto libre; solo se usa cuando no hay `responsable_id`. */
  responsable: string | null;
  /** Vínculo al organigrama (OrgEmpleado). Tiene precedencia sobre el texto. */
  responsable_id: number | null;
  /** Derivado: nombre a mostrar, del empleado vinculado o del texto libre. */
  responsable_nombre: string | null;
  fecha_inicio: string;
  duracion_dias: number;
  dep_id: number | null;
  estado: string;
  avance: number;
  orden: number;
}

export interface Proyecto {
  id: number;
  nombre: string;
  descripcion: string | null;
  /** Texto libre; solo se usa cuando no hay `responsable_id`. */
  responsable: string | null;
  /** Vínculo al organigrama (OrgEmpleado). Tiene precedencia sobre el texto. */
  responsable_id: number | null;
  /** Derivado: nombre a mostrar, del empleado vinculado o del texto libre. */
  responsable_nombre: string | null;
  estado: string;
  fecha_inicio: string;
  notas: string | null;
  ingreso_estimado: number;
  otros_ingresos: number;
  moneda_ingreso: string;
  anio_ingreso: number;
  created_by: string | null;
  updated_by: string | null;
  costos: CostoProyecto[];
  etapas: EtapaProyecto[];
}

export interface ConfigProyectos {
  fx_ars: number;
  infl_usd: number;
  anio_base: number;
}

// ─── Fechas (ISO yyyy-mm-dd, sin zona horaria) ───────────────────────────────

/** Se usa mediodía para que los saltos de DST nunca corran un día. */
function parseISO(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

function aISO(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export function hoyISO(): string {
  return aISO(new Date());
}

export function sumarDias(iso: string, dias: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + dias);
  return aISO(d);
}

export function difDias(desde: string, hasta: string): number {
  return Math.round((parseISO(hasta).getTime() - parseISO(desde).getTime()) / 86_400_000);
}

/** "05 mar" — para etiquetas compactas del cronograma. */
export function fmtCorto(iso: string): string {
  const d = parseISO(iso);
  return `${String(d.getDate()).padStart(2, '0')} ${MESES_CORTOS[d.getMonth()]}`;
}

export function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  return parseISO(iso).toLocaleDateString('es-AR');
}

// ─── Formato de números ──────────────────────────────────────────────────────

/**
 * Montos de dinero: siempre 2 decimales y separadores es-AR (1.234,56). Se usa
 * el mismo formato para USD y ARS para que no convivan dos convenciones de
 * puntuación en la misma pantalla (en-US "1,234.56" vs es-AR "1.234,56").
 */
export function fmtMonto(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '—';
  return v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtUSD(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '—';
  return `$${fmtMonto(v)}`;
}

export function fmt1(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '—';
  return v.toLocaleString('es-AR', { maximumFractionDigits: 1 });
}

// ─── Modelo financiero ───────────────────────────────────────────────────────

/** Lleva un monto a USD según la moneda en la que fue cargado. */
export function aUSD(monto: number, moneda: string, cfg: ConfigProyectos): number {
  const v = Number(monto) || 0;
  return moneda === 'ARS' ? v / (cfg.fx_ars || 1) : v;
}

/** Total de una línea de costo: cantidad × costo unitario, en USD. */
export function costoLineaUSD(c: CostoProyecto, cfg: ConfigProyectos): number {
  return aUSD((Number(c.cantidad) || 0) * (Number(c.costo_unitario) || 0), c.moneda, cfg);
}

export function costoTotalUSD(p: Proyecto, cfg: ConfigProyectos): number {
  return p.costos.reduce((s, c) => s + costoLineaUSD(c, cfg), 0);
}

export function ingresoUSD(p: Proyecto, cfg: ConfigProyectos): number {
  return aUSD(
    (Number(p.ingreso_estimado) || 0) + (Number(p.otros_ingresos) || 0),
    p.moneda_ingreso,
    cfg,
  );
}

/** Lleva un monto de `desdeAnio` a USD constantes del año base. */
export function deflactar(v: number, desdeAnio: number | null, cfg: ConfigProyectos): number {
  const anios = (desdeAnio || cfg.anio_base) - cfg.anio_base;
  return v / Math.pow(1 + cfg.infl_usd / 100, anios);
}

/** Operación inversa: del año base al poder adquisitivo de `haciaAnio`. */
export function inflar(v: number, haciaAnio: number | null, cfg: ConfigProyectos): number {
  const anios = (haciaAnio || cfg.anio_base) - cfg.anio_base;
  return v * Math.pow(1 + cfg.infl_usd / 100, anios);
}

/** Avance ponderado por duración: una etapa larga pesa más que una corta. */
export function avanceEtapas(etapas: { duracion_dias: number; avance: number }[]): number {
  const totalDias = etapas.reduce((s, t) => s + Math.max(1, t.duracion_dias), 0);
  if (totalDias === 0) return 0;
  const ponderado = etapas.reduce(
    (s, t) => s + Math.max(0, Math.min(100, t.avance)) * Math.max(1, t.duracion_dias),
    0,
  );
  return Math.round(ponderado / totalDias);
}

export function avanceProyecto(p: Proyecto): number {
  return avanceEtapas(p.etapas);
}

/** Fin del cronograma: la última fecha de término entre todas las etapas. */
export function finCronograma(
  fechaInicio: string,
  etapas: { fecha_inicio: string; duracion_dias: number }[],
): string {
  return etapas.reduce((max, t) => {
    const e = sumarDias(t.fecha_inicio, t.duracion_dias);
    return e > max ? e : max;
  }, fechaInicio);
}

export interface ResumenFinanciero {
  /** Costo nominal, sin deflactar. */
  costo: number;
  /** Costo en USD constantes del año base. */
  costoConst: number;
  ingreso: number;
  ingresoConst: number;
  margen: number;
  margenPct: number | null;
  roi: number | null;
  /** Ingreso nominal mínimo, en el año de ingreso, para no perder plata. */
  breakeven: number;
  /** % que puede caer el ingreso antes de entrar en pérdida. */
  seguridad: number | null;
  avance: number;
  etapasHechas: number;
  etapasAtrasadas: number;
  fin: string;
  duracionDias: number;
}

export function resumenFinanciero(p: Proyecto, cfg: ConfigProyectos): ResumenFinanciero {
  const costo = costoTotalUSD(p, cfg);
  const costoConst = deflactar(costo, cfg.anio_base, cfg);
  const ingreso = ingresoUSD(p, cfg);
  const ingresoConst = deflactar(ingreso, p.anio_ingreso, cfg);
  const margen = ingresoConst - costoConst;

  // El costo está expresado en el año base; para compararlo con un ingreso que
  // se cobra más adelante hay que llevarlo al poder adquisitivo de ese año.
  const breakeven = inflar(costoConst, p.anio_ingreso, cfg);

  const etapasHechas = p.etapas.filter((t) => t.estado === 'hecho').length;
  const etapasAtrasadas = p.etapas.filter((t) => t.estado === 'atrasado').length;
  const fin = finCronograma(p.fecha_inicio, p.etapas);

  return {
    costo,
    costoConst,
    ingreso,
    ingresoConst,
    margen,
    margenPct: ingresoConst > 0 ? (margen / ingresoConst) * 100 : null,
    roi: costoConst > 0 ? (margen / costoConst) * 100 : null,
    breakeven,
    seguridad: ingreso > 0 ? ((ingreso - breakeven) / ingreso) * 100 : null,
    avance: avanceProyecto(p),
    etapasHechas,
    etapasAtrasadas,
    fin,
    duracionDias: difDias(p.fecha_inicio, fin),
  };
}

export type VeredictoFinanciero = 'recomendado' | 'ajustado' | 'no-cubre' | 'sin-datos';

export function veredictoFinanciero(r: ResumenFinanciero): VeredictoFinanciero {
  if (r.costo <= 0 && r.ingreso <= 0) return 'sin-datos';
  if (r.ingreso <= 0) return 'sin-datos';
  if (r.margen <= 0) return 'no-cubre';
  return (r.seguridad ?? 0) < 15 ? 'ajustado' : 'recomendado';
}

/** Lectura en castellano del análisis, para no dejar al usuario solo con números. */
export function lecturaFinanciera(r: ResumenFinanciero): string {
  if (r.ingreso <= 0) {
    return r.costo > 0
      ? `Por ahora es solo una inversión de ${fmtUSD(
          r.costoConst,
        )}: cargá el ingreso proyectado para ver margen, ROI y punto de equilibrio.`
      : 'Cargá los costos y el ingreso proyectado para ver el análisis.';
  }
  if (r.margen <= 0) {
    return `Con estos supuestos el proyecto no cubre costos: necesitás al menos ${fmtUSD(
      r.breakeven,
    )} de ingreso y hoy proyectás ${fmtUSD(r.ingreso)}. Revisá el ingreso o bajá costos.`;
  }
  const seg = r.seguridad ?? 0;
  if (seg < 15) {
    return `El proyecto da ganancia pero con margen ajustado: el ingreso puede caer solo ${fmt1(
      seg,
    )}% antes de entrar en pérdida. Cualquier desvío te deja al límite.`;
  }
  return `Proyecto sólido: ROI de ${fmt1(r.roi)}% y el ingreso puede caer hasta ${fmt1(
    seg,
  )}% sin entrar en pérdida. Buen colchón ante desvíos.`;
}

// ─── Agregados para el resumen ───────────────────────────────────────────────

export interface AgrupadoCosto {
  clave: string;
  etiqueta: string;
  total: number;
  /** % sobre el costo total del proyecto. */
  porcentaje: number;
}

function agrupar(
  costos: CostoProyecto[],
  cfg: ConfigProyectos,
  clave: (c: CostoProyecto) => { id: string; etiqueta: string },
): AgrupadoCosto[] {
  const mapa = new Map<string, AgrupadoCosto>();
  let total = 0;
  costos.forEach((c) => {
    const { id, etiqueta } = clave(c);
    const monto = costoLineaUSD(c, cfg);
    total += monto;
    const actual = mapa.get(id);
    if (actual) actual.total += monto;
    else mapa.set(id, { clave: id, etiqueta, total: monto, porcentaje: 0 });
  });
  const filas = [...mapa.values()];
  filas.forEach((f) => {
    f.porcentaje = total > 0 ? (f.total / total) * 100 : 0;
  });
  return filas.sort((a, b) => b.total - a.total);
}

export function costoPorCategoria(p: Proyecto, cfg: ConfigProyectos): AgrupadoCosto[] {
  return agrupar(p.costos, cfg, (c) => ({
    id: c.categoria || 'General',
    etiqueta: c.categoria || 'General',
  }));
}

export function costoPorEtapa(p: Proyecto, cfg: ConfigProyectos): AgrupadoCosto[] {
  return agrupar(p.costos, cfg, (c) => {
    const etapa = c.etapa_id != null ? p.etapas.find((t) => t.id === c.etapa_id) : null;
    return {
      id: etapa ? String(etapa.id) : 'sin-etapa',
      etiqueta: etapa ? etapa.nombre : 'Sin etapa asignada',
    };
  });
}

// ─── Cronograma ──────────────────────────────────────────────────────────────

/**
 * Corre una etapa `dias` días y arrastra en cascada a todo lo que depende de
 * ella. Devuelve el nuevo mapa `id → fecha_inicio` para persistirlo de una vez.
 */
export function correrEnCascada(
  etapas: EtapaProyecto[],
  etapaId: number,
  dias: number,
): Record<number, string> {
  const cambios: Record<number, string> = {};
  if (!dias) return cambios;
  const visitados = new Set<number>();

  const recorrer = (id: number) => {
    if (visitados.has(id)) return;
    visitados.add(id);
    const t = etapas.find((x) => x.id === id);
    if (!t) return;
    cambios[id] = sumarDias(t.fecha_inicio, dias);
    etapas.filter((x) => x.dep_id === id).forEach((x) => recorrer(x.id));
  };

  recorrer(etapaId);
  return cambios;
}

export function limitesCronograma(p: Proyecto) {
  let min = p.fecha_inicio;
  let max = p.fecha_inicio;
  p.etapas.forEach((t) => {
    if (t.fecha_inicio < min) min = t.fecha_inicio;
    const fin = sumarDias(t.fecha_inicio, t.duracion_dias);
    if (fin > max) max = fin;
  });
  min = sumarDias(min, -4);
  max = sumarDias(max, 6);
  return { min, max, dias: Math.max(1, difDias(min, max)) };
}

/**
 * Etapas cuya fecha de fin ya pasó y no están marcadas como hechas. Alimenta la
 * alerta del resumen: lo que el cronograma dice que debería estar terminado.
 */
export function etapasVencidas(p: Proyecto, hoy: string): EtapaProyecto[] {
  return p.etapas.filter(
    (t) => t.estado !== 'hecho' && sumarDias(t.fecha_inicio, t.duracion_dias) < hoy,
  );
}
