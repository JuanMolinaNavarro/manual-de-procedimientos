import { NextResponse } from 'next/server';
import { canEditModule } from '@/lib/admin-auth';
import { seedOrganigrama } from '@/lib/organigrama-seed';

// POST — carga la empresa de ejemplo solo si todavía no hay ninguna (bootstrap inicial).
// No borra nada: el viejo `reset` («Reiniciar») se quitó por riesgo (decisión del usuario 2026-09-30).
export async function POST() {
  try {
    if (!(await canEditModule('organigrama'))) {
      return NextResponse.json({ error: 'Sin permiso de edición' }, { status: 403 });
    }
    return NextResponse.json(await seedOrganigrama());
  } catch (error) {
    console.error('Error en POST /api/admin/organigrama/seed:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
