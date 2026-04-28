import { NextResponse } from 'next/server';
import { getAllSportsForAdmin } from '@/lib/deportes';

export async function GET() {
  try {
    const data = await getAllSportsForAdmin();
    return NextResponse.json(data);
  } catch (err) {
    console.error('GET /api/admin/deportes/data:', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
