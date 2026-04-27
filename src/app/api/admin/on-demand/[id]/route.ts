import { NextRequest, NextResponse } from 'next/server';
import { setOnDemandActive } from '@/lib/on-demand';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { isActive } = await request.json();

  if (typeof isActive !== 'boolean') {
    return NextResponse.json({ error: 'isActive debe ser booleano' }, { status: 400 });
  }

  const movie = await setOnDemandActive(parseInt(id, 10), isActive);
  return NextResponse.json(movie);
}
