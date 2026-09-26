import { NextResponse } from 'next/server';
import { getAllLeads } from '@/lib/leads';
import { isAdmin } from '@/lib/admin-auth';

export async function GET() {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const leads = await getAllLeads();
    return NextResponse.json(leads);
  } catch (error) {
    console.error('Error en GET /api/admin/leads:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
