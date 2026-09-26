/**
 * Lógica pura de la importación de recibos de Finnegans (cliente ↔ servidor, sin
 * Prisma ni fs). Ver CLAUDE.md › "Recibos de Finnegans".
 *
 * - `RESUMENLIQ` trae una fila por legajo liquidado; `agruparPorTransaccion` la
 *   convierte en el índice de liquidaciones (una por TRANSACCIONID).
 * - La sábana del modelo "Oficial" trae una página (o más) por legajo;
 *   `asignarPaginas` decide qué páginas son de quién buscando el CUIL de cada
 *   legajo esperado en el texto de la página, y controla el neto.
 * - Cualquier diferencia frena la publicación: nunca se entrega un recibo que no
 *   se pudo atribuir sin ambigüedad.
 */

/** Fila cruda de RESUMENLIQ (claves en MAYÚSCULA, tal cual las devuelve la API). */
export type FilaResumenLiq = Record<string, unknown>;

export interface LegajoEsperado {
  liquidacionLegajoId: number;
  cuil: string; // 11 dígitos
  neto: number;
  numeroLegajo: string;
  nombre: string; // "Apellido, Nombre"
}

export interface LiquidacionIndice {
  transaccionId: number;
  empresaCuit: string; // 11 dígitos
  empresaNombre: string;
  nroLiquidacion: number;
  tipoLiquidacion: string;
  periodo: string; // yyyy-mm
  fechaDesde: string; // ISO
  fechaHasta: string;
  fechaPago: string;
  legajos: LegajoEsperado[];
}

export interface GrupoRecibo {
  liquidacionLegajoId: number;
  cuil: string;
  paginas: number[]; // 0-based, en orden
}

export interface ResultadoAsignacion {
  grupos: GrupoRecibo[];
  diferencias: string[];
}

export function soloDigitos(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '');
}

function texto(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

function numero(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : NaN;
}

/** `dd/mm/yyyy` o `dd-mm-yyyy` (formatos de los reportes) → `yyyy-mm-dd`; si no, ''. */
export function fechaIso(v: unknown): string {
  const m = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(texto(v));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

/** Período `yyyy-mm` a partir de la fecha hasta de la liquidación. */
export function periodoDe(fechaHasta: unknown): string {
  return fechaIso(fechaHasta).slice(0, 7);
}

/** Importe con el formato con que lo imprime el recibo: `1.053.625,00`. */
export function formatoNeto(n: number): string {
  const [ent, dec] = Math.abs(n).toFixed(2).split('.');
  const conMiles = ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${n < 0 ? '-' : ''}${conMiles},${dec}`;
}

/**
 * Agrupa las filas de RESUMENLIQ por transacción. Lanza si una fila no trae los
 * datos mínimos o si una transacción mezcla empresas (no debería pasar nunca).
 */
export function agruparPorTransaccion(filas: FilaResumenLiq[]): LiquidacionIndice[] {
  const porTx = new Map<number, LiquidacionIndice>();
  for (const f of filas) {
    const tx = numero(f.TRANSACCIONID);
    const llId = numero(f.LIQUIDACIONLEGAJOID);
    const cuil = soloDigitos(f.IDENTIFICACIONTRIBUTARIANUMERO);
    const neto = numero(f.NETO);
    if (!Number.isInteger(tx) || !Number.isInteger(llId) || cuil.length !== 11 || !Number.isFinite(neto)) {
      throw new Error(`Fila de RESUMENLIQ incompleta (transacción ${texto(f.TRANSACCIONID) || '?'})`);
    }
    const empresaCuit = soloDigitos(f.EMPRESACUIT);
    let liq = porTx.get(tx);
    if (!liq) {
      liq = {
        transaccionId: tx,
        empresaCuit,
        empresaNombre: texto(f.EMPRESANOMBRE),
        nroLiquidacion: numero(f.NROLIQUIDACION),
        tipoLiquidacion: texto(f.TIPOLIQUIDACION),
        periodo: periodoDe(f.FECHAHASTA),
        fechaDesde: fechaIso(f.FECHADESDE),
        fechaHasta: fechaIso(f.FECHAHASTA),
        fechaPago: fechaIso(f.FECHAPAGO),
        legajos: [],
      };
      porTx.set(tx, liq);
    } else if (liq.empresaCuit !== empresaCuit) {
      throw new Error(`La transacción ${tx} mezcla empresas (${liq.empresaCuit} y ${empresaCuit})`);
    }
    liq.legajos.push({
      liquidacionLegajoId: llId,
      cuil,
      neto,
      numeroLegajo: texto(f.NUMEROLEGAJO),
      nombre: texto(f.LEGAJOAPELLIDONOMBRE) || [texto(f.PERSONAAPELLIDO), texto(f.PERSONANOMBRE)].filter(Boolean).join(', '),
    });
  }
  return [...porTx.values()].sort((a, b) => a.transaccionId - b.transaccionId);
}

/** Tokens con forma de CUIT/CUIL (con o sin guiones) → 11 dígitos. */
export function tokensCuil(txt: string): string[] {
  return [...txt.matchAll(/(?<!\d)(\d{2})-?(\d{8})-?(\d)(?!\d)/g)].map((m) => m[1] + m[2] + m[3]);
}

/** Prefijos de CUIL de personas humanas (los de empresa son 30/33/34). */
const PREFIJO_PERSONA = /^(20|23|24|27)/;

/**
 * Asigna las páginas de la sábana a los legajos esperados.
 *
 * - Página con exactamente un CUIL esperado → empieza el recibo de esa persona.
 * - Página sin CUIL esperado → continuación del recibo anterior (recibos de más de
 *   una hoja). Si es la primera, o si trae el CUIL de una persona que no está en
 *   la liquidación, es una diferencia.
 * - Página con dos o más CUIL esperados, o un CUIL que ya tuvo su recibo → diferencia.
 * - Al final: legajo esperado sin páginas → diferencia; neto que no aparece en el
 *   texto de sus páginas → diferencia.
 */
export function asignarPaginas(
  textos: string[],
  esperados: Pick<LegajoEsperado, 'liquidacionLegajoId' | 'cuil' | 'neto' | 'nombre'>[],
  empresaCuit = '',
): ResultadoAsignacion {
  const diferencias: string[] = [];
  const porCuil = new Map(esperados.map((e) => [e.cuil, e]));
  const grupos: GrupoRecibo[] = [];
  const asignados = new Set<string>();

  textos.forEach((txt, i) => {
    const nro = i + 1;
    const tokens = [...new Set(tokensCuil(txt))];
    const encontrados = tokens.filter((t) => porCuil.has(t));
    if (encontrados.length > 1) {
      diferencias.push(`La página ${nro} tiene más de un CUIL de la liquidación.`);
      return;
    }
    if (encontrados.length === 1) {
      const cuil = encontrados[0];
      if (asignados.has(cuil)) {
        diferencias.push(`El CUIL ${cuil} aparece en más de un recibo (página ${nro}).`);
        return;
      }
      asignados.add(cuil);
      grupos.push({ liquidacionLegajoId: porCuil.get(cuil)!.liquidacionLegajoId, cuil, paginas: [i] });
      return;
    }
    const ajenos = tokens.filter((t) => t !== empresaCuit && PREFIJO_PERSONA.test(t));
    if (ajenos.length > 0) {
      diferencias.push(`La página ${nro} es de un CUIL que no está en la liquidación (${ajenos.join(', ')}).`);
      return;
    }
    const ultimo = grupos[grupos.length - 1];
    if (!ultimo) {
      diferencias.push(`La página ${nro} no tiene ningún CUIL de la liquidación.`);
      return;
    }
    ultimo.paginas.push(i);
  });

  for (const e of esperados) {
    if (!asignados.has(e.cuil)) diferencias.push(`Falta el recibo de ${e.nombre || e.cuil} (CUIL ${e.cuil}).`);
  }
  for (const g of grupos) {
    const e = porCuil.get(g.cuil)!;
    const txt = g.paginas.map((p) => textos[p]).join(' ');
    if (!txt.includes(formatoNeto(e.neto))) {
      diferencias.push(`El neto de ${e.nombre || e.cuil} no coincide con el de Finnegans (${formatoNeto(e.neto)}).`);
    }
  }
  return { grupos, diferencias };
}

export type RespuestaPdf = { ok: true } | { ok: false; motivo: string };

/**
 * `report/execute` responde 200 + `application/pdf` también cuando falla: con cuerpo
 * vacío (faltan XMLFILE/DATASOURCE) o con un HTML de error ("No hay datos para
 * generar PDF"). Solo es PDF si empieza con `%PDF`.
 */
export function clasificarRespuestaPdf(buf: Uint8Array): RespuestaPdf {
  if (buf.length === 0) return { ok: false, motivo: 'Finnegans devolvió un PDF vacío (revisar el modelo de recibo configurado).' };
  const cabecera = String.fromCharCode(...buf.subarray(0, 4));
  if (cabecera === '%PDF') return { ok: true };
  const txt = new TextDecoder('utf-8', { fatal: false })
    .decode(buf.subarray(0, 2000))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\\"/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
  const limpio = txt.replace(/^Se ha producido un error\s*/i, '');
  return { ok: false, motivo: `Finnegans no devolvió un PDF: ${limpio.slice(0, 200) || 'respuesta desconocida'}` };
}

// ─── Firma en el portal: estado de entrega y validación ────────────────────

/** Días desde la publicación (puesta a disposición) sin firma → "no retirado". */
export const DIAS_NO_RETIRADO = 15;

export type EstadoEntrega = 'pendiente' | 'no_retirado' | 'firmado' | 'papel';

/**
 * Estado de entrega de un recibo. "No retirado" se deriva (no se guarda): sin firma
 * ni papel a los 15 días de publicado. Nunca implica conformidad (art. 58 LCT):
 * solo indica que corresponde entregarlo en papel.
 */
export function estadoEntrega(
  r: { estado: string; publicado: Date | string },
  hoy: Date = new Date(),
): { estado: EstadoEntrega; dias: number } {
  const dias = Math.floor((hoy.getTime() - new Date(r.publicado).getTime()) / 86_400_000);
  if (r.estado === 'firmado') return { estado: 'firmado', dias };
  if (r.estado === 'papel') return { estado: 'papel', dias };
  return { estado: dias >= DIAS_NO_RETIRADO ? 'no_retirado' : 'pendiente', dias };
}

export type Conformidad = 'conforme' | 'disconforme';

export interface FirmaValida {
  pin: string;
  conformidad: Conformidad;
  observaciones: string;
}

/**
 * Valida la entrada de una firma antes de tocar el PIN: la declaración de lectura
 * es obligatoria, la conformidad debe ser explícita (no hay valor por defecto) y
 * la disconformidad exige observaciones.
 */
export function validarFirmaInput(input: {
  pin?: unknown;
  conformidad?: unknown;
  observaciones?: unknown;
  leido?: unknown;
}): { ok: true; firma: FirmaValida } | { ok: false; error: string } {
  if (input.leido !== true) return { ok: false, error: 'Falta la declaración de lectura del recibo' };
  if (input.conformidad !== 'conforme' && input.conformidad !== 'disconforme') {
    return { ok: false, error: 'Elegí si firmás en conformidad o en disconformidad' };
  }
  const pin = typeof input.pin === 'string' ? input.pin.trim() : '';
  if (!/^\d{4,8}$/.test(pin)) return { ok: false, error: 'Ingresá tu PIN (4 a 8 dígitos)' };
  const observaciones = typeof input.observaciones === 'string' ? input.observaciones.trim().slice(0, 2000) : '';
  if (input.conformidad === 'disconforme' && !observaciones) {
    return { ok: false, error: 'Para firmar en disconformidad escribí tus observaciones' };
  }
  return { ok: true, firma: { pin, conformidad: input.conformidad, observaciones } };
}
