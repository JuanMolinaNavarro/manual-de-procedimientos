import { NextResponse } from 'next/server';
import { syncSportsData, isSyncRunning, getSyncStatus } from '@/lib/deportes';

export async function GET() {
  try {
    const status = await getSyncStatus();
    return NextResponse.json(status);
  } catch (err) {
    console.error('GET /api/admin/deportes/sync:', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST() {
  if (isSyncRunning()) {
    return NextResponse.json({ error: 'Sincronización ya en ejecución' }, { status: 409 });
  }
  syncSportsData().catch(err => console.error('[deportes sync]', err));
  return NextResponse.json({ started: true });
}
