import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleAdmin } from '@/lib/api-admin';

export async function GET() {
  return handleAdmin('GET /api/admin/mwproxy/catalog', async () => {
    const entries = await prisma.mwproxyCatalog.findMany({
      orderBy: [{ imdb_votes: 'desc' }, { name: 'asc' }],
    });
    return NextResponse.json(entries);
  });
}
