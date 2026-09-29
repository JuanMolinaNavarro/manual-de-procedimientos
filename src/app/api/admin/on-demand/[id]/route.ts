import { NextRequest, NextResponse } from 'next/server';
import { setOnDemandActive } from '@/lib/on-demand';
import { handleAdmin } from '@/lib/api-admin';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleAdmin('PATCH /api/admin/on-demand/[id]', async () => {
    const { id } = await params;
    const n = Number(id);
    if (!Number.isInteger(n) || n <= 0) {
      return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    }
    const { isActive } = await request.json().catch(() => ({}));
    if (typeof isActive !== 'boolean') {
      return NextResponse.json({ error: 'isActive debe ser booleano' }, { status: 400 });
    }
    return NextResponse.json(await setOnDemandActive(n, isActive));
  });
}
