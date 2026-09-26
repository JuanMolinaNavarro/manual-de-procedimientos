import { NextResponse } from 'next/server';
import { getAllSportsForAdmin } from '@/lib/deportes';
import { handleAdmin } from '@/lib/api-admin';

export async function GET() {
  return handleAdmin('GET /api/admin/deportes/data', async () => NextResponse.json(await getAllSportsForAdmin()));
}
