import { NextResponse } from 'next/server';
import { fetchAllVods } from '@/lib/mwproxy';

export async function GET() {
  try {
    const vods = await fetchAllVods();
    return NextResponse.json(vods);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
