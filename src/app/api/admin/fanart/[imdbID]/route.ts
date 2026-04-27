import { NextRequest, NextResponse } from 'next/server';
import { getFanartForMovie } from '@/lib/fanart';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ imdbID: string }> }
) {
  const { imdbID } = await params;

  if (!/^tt\d{7,8}$/.test(imdbID)) {
    return NextResponse.json({ error: 'IMDb ID inválido' }, { status: 400 });
  }

  try {
    const images = await getFanartForMovie(imdbID);
    return NextResponse.json(images ?? { backgrounds: [], logos: [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
