/**
 * Helpers de las rutas /api/admin/nomina/**: parseo de query/body y mapeo de
 * errores a respuestas con la convención del panel (400/401/404/409 con
 * mensaje en castellano; 500 genérico con log).
 */

import { NextResponse } from 'next/server';
import { isAdmin } from './admin-auth';
import { PERIODO_RE } from './nomina-datos';
import { NominaError } from './nomina';

/**
 * Envuelve un handler: exige rol admin (401), y traduce NominaError / errores
 * inesperados a la respuesta convenida.
 */
export async function handle(where: string, fn: () => Promise<Response>): Promise<Response> {
  try {
    if (!(await isAdmin())) return NO_AUTORIZADO();
    return await fn();
  } catch (error) {
    return errorResponse(error, where);
  }
}

/**
 * Como `handle` pero sin exigir rol admin: rutas personales (Mis recibos) que usa
 * el rol `empleado`. La ruta toma la ficha SOLO de `getUsuarioSesion()`.
 */
export async function handleSesion(where: string, fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    return errorResponse(error, where);
  }
}

/** Body JSON tolerante (vacío o inválido → {}). */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const b = await request.json();
    return b && typeof b === 'object' ? (b as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function parseOrgId(v: unknown): number {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  if (!Number.isInteger(n) || n <= 0) throw new NominaError('Falta el organigrama (organigramaId)', 400);
  return n;
}

export function parsePeriodo(v: unknown): string {
  if (typeof v !== 'string' || !PERIODO_RE.test(v)) throw new NominaError('Período inválido (formato YYYY-MM)', 400);
  return v;
}

export function parseId(v: unknown, nombre = 'id'): number {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  if (!Number.isInteger(n) || n <= 0) throw new NominaError(`${nombre} inválido`, 400);
  return n;
}

export function errorResponse(error: unknown, where: string): NextResponse {
  if (error instanceof NominaError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(`Error en ${where}:`, error);
  return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
}

export const NO_AUTORIZADO = () => NextResponse.json({ error: 'No autorizado' }, { status: 401 });

/** Respuesta PDF (inline o descarga) sin cache compartida. */
export function pdfResponse(pdf: Uint8Array, nombre: string, descargar = false): NextResponse {
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${descargar ? 'attachment' : 'inline'}; filename="${nombre.replace(/[^\w.-]/g, '_')}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
