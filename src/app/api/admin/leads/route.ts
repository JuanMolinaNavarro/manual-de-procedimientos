import { NextResponse } from 'next/server';
import { getAllLeads } from '@/lib/leads';
import { cookies } from 'next/headers';
import { isAdminRole } from '@/lib/roles';

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get('site_session');
  if (!session?.value) return false;
  const parts = session.value.split('|');
  return parts.length > 1 && isAdminRole(parts[1]);
}

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
