import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { getOrganigramaCompleto } from '@/lib/organigrama';

// GET ?organigramaId=N — grafo (empleados + áreas + líneas) de esa empresa/ubicación.
export async function GET(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const idParam = request.nextUrl.searchParams.get('organigramaId');
    const orgId = idParam ? Number(idParam) : NaN;
    if (!orgId || Number.isNaN(orgId)) {
      return NextResponse.json({ empleados: [], areas: [], lineas: [] });
    }
    const data = await getOrganigramaCompleto(orgId);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error en GET /api/admin/organigrama:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
