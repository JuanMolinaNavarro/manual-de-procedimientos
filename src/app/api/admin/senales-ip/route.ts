import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAlarmasActivas } from '@/lib/senales-ip';
import { prisma } from '@/lib/prisma';

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get('site_session');
  const role = session?.value?.split('|')[1];
  return role === 'admin';
}

export async function GET() {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const [alarmas, compradores_count, vendedores_count] = await Promise.all([
      getAlarmasActivas(),
      prisma.contratoComprador.count(),
      prisma.contratoVendedor.count(),
    ]);
    return NextResponse.json({ alarmas, compradores_count, vendedores_count });
  } catch (error) {
    console.error('Error en GET /api/admin/senales-ip:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
