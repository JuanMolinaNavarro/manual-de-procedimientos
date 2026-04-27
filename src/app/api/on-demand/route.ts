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
  const movies = await getActiveOnDemand();
  return NextResponse.json(movies, {
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
}
