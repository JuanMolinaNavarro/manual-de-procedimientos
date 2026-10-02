import { NextRequest, NextResponse } from 'next/server';
import { canEditModule, isAdmin } from '@/lib/admin-auth';
import { hoyLocal } from '@/lib/fechas';
import { getPendientesAsistencia } from '@/lib/organigrama';

/** GET ?organigramaId=N — fichas de esa empresa sin legajo del reloj o sin horario (barra del organigrama). */
export async function GET(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    if (!(await canEditModule('organigrama'))) {
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
    }
    const orgId = Number(request.nextUrl.searchParams.get('organigramaId'));
    if (!Number.isInteger(orgId) || orgId <= 0) {
      return NextResponse.json({ error: 'organigramaId inválido' }, { status: 400 });
    }
    return NextResponse.json(await getPendientesAsistencia(orgId, hoyLocal()));
  } catch (error) {
    console.error('Error en GET /api/admin/organigrama/pendientes-asistencia:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
