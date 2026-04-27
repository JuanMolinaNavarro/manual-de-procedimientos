import { NextRequest, NextResponse } from 'next/server';
import { searchMovies } from '@/lib/omdb';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim();
  if (!q) {
    return NextResponse.json({ error: 'Parámetro q requerido' }, { status: 400 });
  }

  const pageParam = request.nextUrl.searchParams.get('page');
  const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;

  try {
    const data = await searchMovies(q, { type: 'movie', page });
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
