import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { getOrganigramaCompleto } from '@/lib/organigrama';

// GET — grafo completo (empleados + áreas + líneas) para el bootstrap del lienzo.
export async function GET() {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const data = await getOrganigramaCompleto();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error en GET /api/admin/organigrama:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
