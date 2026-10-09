/**
 * Wrappers de las rutas `/api/admin/**`: `handle` exige sesión admin (401) y `handleSesion` solo
 * atrapa errores (rutas personales del rol `empleado`, que toman la ficha SOLO de la sesión).
 * Un `ApiError` (o sus subclases por módulo) sale con su status y mensaje; cualquier otro error,
 * como 500 genérico con el detalle en el log (nunca `err.message` al cliente).
 */

import { NextResponse } from 'next/server';
import { isAdmin } from './admin-auth';
import { ApiError } from './api-error';

export function respuestaError(error: unknown, where: string): NextResponse {
  if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error(`Error en ${where}:`, error);
  return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
}

export async function handleSesion(where: string, fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    return respuestaError(error, where);
  }
}

export async function handle(where: string, fn: () => Promise<Response>): Promise<Response> {
  return handleSesion(where, async () =>
    (await isAdmin()) ? fn() : NextResponse.json({ error: 'No autorizado' }, { status: 401 }));
}

/** Body JSON tolerante: vacío, inválido o que no sea un objeto → {}. */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const b = await request.json();
    return b && typeof b === 'object' && !Array.isArray(b) ? (b as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Entero positivo (de la URL o del body); si no, 400. */
export function parseId(v: unknown, nombre = 'id'): number {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  if (!Number.isInteger(n) || n <= 0) throw new ApiError(`${nombre} inválido`);
  return n;
}
