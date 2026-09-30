import { NextRequest, NextResponse } from 'next/server';
import { canEditModule, isAdmin } from '@/lib/admin-auth';
import { getOrganigramaCompleto, ocultarConvenio } from '@/lib/organigrama';

// GET ?organigramaId=N — grafo (empleados + áreas + líneas) de esa empresa/ubicación.
export async function GET(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const idParam = request.nextUrl.searchParams.get('organigramaId');
    const orgId = idParam ? Number(idParam) : NaN;
    if (!orgId || Number.isNaN(orgId)) {
      return NextResponse.json({ empleados: [], areas: [], lineas: [], ocultos: [] });
    }
    const data = await getOrganigramaCompleto(orgId);
    const puedeVer = await canEditModule('organigrama');
    return NextResponse.json({ ...data, empleados: data.empleados.map((e) => ocultarConvenio(e, puedeVer)) });
  } catch (error) {
    console.error('Error en GET /api/admin/organigrama:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
