/**
 * Wrapper genérico para rutas `/api/admin/**` que no tienen uno propio (como los `handle()` de
 * nómina y asistencia): exige sesión admin (401) y convierte cualquier error en un 500 con
 * mensaje genérico, dejando el detalle en el log (nunca `err.message` al cliente).
 */

import { NextResponse } from 'next/server';
import { isAdmin } from './admin-auth';

export async function handleAdmin(where: string, fn: () => Promise<Response>): Promise<Response> {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    return await fn();
  } catch (error) {
    console.error(`Error en ${where}:`, error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
