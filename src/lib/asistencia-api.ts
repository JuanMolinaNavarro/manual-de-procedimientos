/**
 * Helpers de las rutas /api/admin/asistencia/**: parseo de query/body propio de asistencia.
 * Los wrappers y el mapeo de errores son los comunes de `api-admin.ts` (un `AnvizError`, falla
 * de comunicación con el reloj, sale como 502 con su mensaje).
 */

import { AsistenciaError } from './asistencia';
import { FECHA_RE, hoyLocal, inicioDeMes, type FiltrosFichadas } from './asistencia-datos';
import { MES_RE } from './fechas';

export { handle, handleSesion, parseId, readJson } from './api-admin';

/**
 * Booleano estricto del body: `Boolean("false")` es `true`, así que un "false" como texto
 * prendía el switch. Acepta true/false (o "true"/"false"); cualquier otra cosa es 400.
 */
export function parseBool(v: unknown, nombre: string): boolean | undefined {
  if (v == null) return undefined;
  if (v === true || v === 'true') return true;
  if (v === false || v === 'false') return false;
  throw new AsistenciaError(`${nombre} tiene que ser true o false`);
}

/** Días máximos de un rango de consulta pesada (export). */
export const MAX_DIAS_RANGO = 366;

/** 400 si el rango de fechas supera `MAX_DIAS_RANGO` días. */
export function exigirRango(f: FiltrosFichadas): void {
  const dias = (Date.parse(f.hasta) - Date.parse(f.desde)) / 86_400_000 + 1;
  if (dias > MAX_DIAS_RANGO) throw new AsistenciaError(`El rango no puede superar ${MAX_DIAS_RANGO} días`);
}

/** Lee los filtros de fichadas del query string, con defaults al mes actual. */
export function parseFiltros(url: URL): FiltrosFichadas {
  const p = url.searchParams;
  const hoy = hoyLocal();
  const desde = p.get('desde');
  const hasta = p.get('hasta');
  const f: FiltrosFichadas = {
    desde: desde && FECHA_RE.test(desde) ? desde : inicioDeMes(hoy),
    hasta: hasta && FECHA_RE.test(hasta) ? hasta : hoy,
  };
  const relojId = p.get('relojId');
  if (relojId && Number(relojId) > 0) f.relojId = Number(relojId);
  const userId = p.get('userId');
  if (userId) f.userId = userId;
  const q = p.get('q');
  if (q) f.q = q;
  if (p.get('soloSospechosas') === '1') f.soloSospechosas = true;
  if (p.get('soloIncompletos') === '1') f.soloIncompletos = true;
  return f;
}

/** `yyyy-mm-dd` del query string; default hoy. */
export function parseFecha(v: string | null): string {
  if (!v) return hoyLocal();
  if (!FECHA_RE.test(v)) throw new AsistenciaError('fecha inválida (yyyy-mm-dd)');
  return v;
}

/** `yyyy-mm` del query string; default el mes actual. */
export function parseMes(v: string | null): string {
  if (!v) return hoyLocal().slice(0, 7);
  if (!MES_RE.test(v)) throw new AsistenciaError('mes inválido (yyyy-mm)');
  return v;
}
