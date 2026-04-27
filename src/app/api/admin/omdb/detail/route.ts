import { NextRequest, NextResponse } from 'next/server';
import { getMovieById } from '@/lib/omdb';

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')?.trim();
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  try {
    const data = await getMovieById(id);
    if (!data) return NextResponse.json(null);
    return NextResponse.json({
      imdbID:     data.imdbID,
      imdbRating: data.imdbRating !== 'N/A' ? data.imdbRating : null,
      imdbVotes:  data.imdbVotes  !== 'N/A' ? data.imdbVotes  : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
