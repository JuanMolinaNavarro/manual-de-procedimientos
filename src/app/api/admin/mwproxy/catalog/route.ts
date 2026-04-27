import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const entries = await prisma.mwproxyCatalog.findMany({
      orderBy: [{ imdb_votes: 'desc' }, { name: 'asc' }],
    });
    return NextResponse.json(entries);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
