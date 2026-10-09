import { NextRequest, NextResponse } from 'next/server';
import { getFanartForMovie } from '@/lib/fanart';
import { handle } from '@/lib/api-admin';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ imdbID: string }> }
) {
  return handle('GET /api/admin/fanart/[imdbID]', async () => {
    const { imdbID } = await params;
    if (!/^tt\d{7,8}$/.test(imdbID)) {
      return NextResponse.json({ error: 'IMDb ID inválido' }, { status: 400 });
    }
    const images = await getFanartForMovie(imdbID);
    return NextResponse.json(images ?? { backgrounds: [], logos: [] });
  });
}
