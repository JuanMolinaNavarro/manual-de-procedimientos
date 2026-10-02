import { NextResponse } from 'next/server';
import { canEditModule, isAdmin } from '@/lib/admin-auth';
import { hoyLocal } from '@/lib/fechas';
import { getPendientesAsistencia } from '@/lib/organigrama';

/** Fichas sin legajo del reloj o sin horario, de todas las empresas (barra del organigrama). */
export async function GET() {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    if (!(await canEditModule('organigrama'))) {
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
    }
    return NextResponse.json(await getPendientesAsistencia(hoyLocal()));
  } catch (error) {
    console.error('Error en GET /api/admin/organigrama/pendientes-asistencia:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
