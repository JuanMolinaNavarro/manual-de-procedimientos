/**
 * Helpers de las rutas /api/admin/asistencia/**: exige rol admin y traduce
 * AsistenciaError (y errores inesperados) a la convención del panel. Espejo de
 * `nomina-api.ts`.
 */

import { NextResponse } from 'next/server';
import { isAdmin } from './admin-auth';
import { AsistenciaError } from './asistencia';
import { AnvizError } from './anviz-tcb';
import { FECHA_RE, type FiltrosFichadas } from './asistencia-datos';

export async function handle(where: string, fn: () => Promise<Response>): Promise<Response> {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    return await fn();
  } catch (error) {
    if (error instanceof AsistenciaError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    // Fallo de comunicación con el reloj (timeout, sin ruta, etc.): mensaje claro, no 500.
    if (error instanceof AnvizError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    console.error(`Error en ${where}:`, error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const b = await request.json();
    return b && typeof b === 'object' ? (b as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function parseId(v: unknown, nombre = 'id'): number {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  if (!Number.isInteger(n) || n <= 0) throw new AsistenciaError(`${nombre} inválido`);
  return n;
}

/** Lee los filtros de fichadas del query string, con defaults al mes actual. */
export function parseFiltros(url: URL): FiltrosFichadas {
  const p = url.searchParams;
  const hoy = new Date(Date.now() - 180 * 60_000).toISOString().slice(0, 10);
  const desde = p.get('desde');
  const hasta = p.get('hasta');
  const f: FiltrosFichadas = {
    desde: desde && FECHA_RE.test(desde) ? desde : hoy.slice(0, 7) + '-01',
    hasta: hasta && FECHA_RE.test(hasta) ? hasta : hoy,
  };
  const relojId = p.get('relojId');
  if (relojId && Number(relojId) > 0) f.relojId = Number(relojId);
  const userId = p.get('userId');
  if (userId) f.userId = userId;
  const q = p.get('q');
  if (q) f.q = q;
  return f;
}
