import { NextResponse } from 'next/server';
import { getSportsForApi } from '@/lib/deportes';

export async function GET() {
  try {
    const data = await getSportsForApi();
    return NextResponse.json(data, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    console.error('GET /api/sports:', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
