import { NextResponse } from 'next/server';
import { cerrarTemporadaActual, entero } from '@/lib/vacaciones';
import { readJson } from '@/lib/api-admin';
import { conSesion } from '@/lib/vacaciones-api';

export const dynamic = 'force-dynamic';

/**
 * Cierra la temporada: historial de veranos y turnos, arrastre propuesto y fechas del año siguiente.
 * Body `{ ejercicio }`: la temporada que se quiere cerrar (un segundo envío no avanza otro año).
 */
export async function POST(request: Request) {
  return conSesion(request, 'POST /api/admin/vacaciones/cerrar', true, async (s) => {
    const ejercicio = entero((await readJson(request)).ejercicio, 'Ejercicio', 2000, 2100);
    return NextResponse.json({ resumen: await cerrarTemporadaActual(ejercicio, s.actor) });
  });
}
