/**
 * API Route: /api/me
 *
 * Devuelve el usuario logueado (sin contraseña).
 */

import { NextResponse } from 'next/server';
import { getSesion } from '@/lib/admin-auth';

export async function GET() {
  try {
    const u = await getSesion();
    if (!u) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    return NextResponse.json({
      usuario: u.usuario,
      nombre: u.nombre,
      apellido: u.apellido,
      rol: u.rol,
      empleado: u.empleado,
    });
  } catch (error) {
    console.error('Error en GET /api/me:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
