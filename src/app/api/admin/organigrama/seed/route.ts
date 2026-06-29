import { NextRequest, NextResponse } from 'next/server';
import { canEditModule } from '@/lib/admin-auth';
import { seedOrganigrama } from '@/lib/organigrama-seed';

// POST { reset?: boolean }
//  - reset=true  → borra todo y carga los datos de ejemplo (usado por "Reiniciar").
//  - reset=false → solo siembra si la tabla está vacía (bootstrap inicial).
export async function POST(request: NextRequest) {
  try {
    if (!(await canEditModule('organigrama'))) {
      return NextResponse.json({ error: 'Sin permiso de edición' }, { status: 403 });
    }
    let reset = false;
    try {
      const body = (await request.json()) as { reset?: boolean };
      reset = Boolean(body?.reset);
    } catch {
      // sin body → reset=false
    }
    const result = await seedOrganigrama(reset);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error en POST /api/admin/organigrama/seed:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
