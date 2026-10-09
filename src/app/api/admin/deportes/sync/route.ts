import { NextResponse } from 'next/server';
import { syncSportsData, isSyncRunning, getSyncStatus } from '@/lib/deportes';
import { handle } from '@/lib/api-admin';

export async function GET() {
  return handle('GET /api/admin/deportes/sync', async () => NextResponse.json(await getSyncStatus()));
}

export async function POST() {
  return handle('POST /api/admin/deportes/sync', async () => {
    if (isSyncRunning()) {
      return NextResponse.json({ error: 'Sincronización ya en ejecución' }, { status: 409 });
    }
    syncSportsData().catch(err => console.error('[deportes sync]', err));
    return NextResponse.json({ started: true });
  });
}
