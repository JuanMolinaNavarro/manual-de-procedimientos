import { NextRequest, NextResponse } from 'next/server';
import { getAllOnDemand, upsertOnDemand } from '@/lib/on-demand';
import { handleAdmin } from '@/lib/api-admin';

export async function GET() {
  return handleAdmin('GET /api/admin/on-demand', async () => NextResponse.json(await getAllOnDemand()));
}

export async function POST(request: NextRequest) {
  return handleAdmin('POST /api/admin/on-demand', async () => {
    const body = await request.json().catch(() => ({}));
    const { imdbID, title, year, poster, background, logo } = body;

    if (!imdbID || !title || !year) {
      return NextResponse.json({ error: 'imdbID, title y year son requeridos' }, { status: 400 });
    }

    const movie = await upsertOnDemand({ imdbID, title, year, poster, background, logo });
    return NextResponse.json(movie);
  });
}
