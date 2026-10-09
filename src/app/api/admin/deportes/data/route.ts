import { NextResponse } from 'next/server';
import { getAllSportsForAdmin } from '@/lib/deportes';
import { handle } from '@/lib/api-admin';

export async function GET() {
  return handle('GET /api/admin/deportes/data', async () => NextResponse.json(await getAllSportsForAdmin()));
}
