import { NextRequest, NextResponse } from 'next/server';
import { searchMovies } from '@/lib/omdb';
import { handleAdmin } from '@/lib/api-admin';

export async function GET(request: NextRequest) {
  return handleAdmin('GET /api/admin/omdb/search', async () => {
    const q = request.nextUrl.searchParams.get('q')?.trim();
    if (!q) {
      return NextResponse.json({ error: 'Parámetro q requerido' }, { status: 400 });
    }
    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page') ?? '1', 10) || 1);
    return NextResponse.json(await searchMovies(q, { type: 'movie', page }));
  });
}
