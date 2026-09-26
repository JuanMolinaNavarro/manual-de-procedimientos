import { NextResponse } from 'next/server';
import { getActiveOnDemand } from '@/lib/on-demand';

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function GET() {
  try {
    const movies = await getActiveOnDemand();
    return NextResponse.json(movies, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  } catch (error) {
    console.error('Error en GET /api/on-demand:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}
