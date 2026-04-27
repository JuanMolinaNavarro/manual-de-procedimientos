import { NextRequest, NextResponse } from 'next/server';
import { getAllOnDemand, upsertOnDemand } from '@/lib/on-demand';

export async function GET() {
  const movies = await getAllOnDemand();
  return NextResponse.json(movies);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { imdbID, title, year, poster, background, logo } = body;

  if (!imdbID || !title || !year) {
    return NextResponse.json({ error: 'imdbID, title y year son requeridos' }, { status: 400 });
  }

  const movie = await upsertOnDemand({ imdbID, title, year, poster, background, logo });
  return NextResponse.json(movie);
}
