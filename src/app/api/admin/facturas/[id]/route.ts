import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { unlinkSync } from 'fs';
import { join } from 'path';
import { getFacturaById, deleteFactura } from '@/lib/facturas';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'facturas');

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get('site_session');
  const role = session?.value?.split('|')[1];
  return role === 'admin';
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const { id } = await params;
    const factura = await getFacturaById(Number(id));
    if (!factura) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
    }
    return NextResponse.json(factura);
  } catch (error) {
    console.error('Error en GET /api/admin/facturas/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const { id } = await params;
    const factura = await getFacturaById(Number(id));
    if (!factura) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
    }
    try {
      unlinkSync(join(UPLOAD_DIR, factura.nombre_archivo));
    } catch {
      // file may already be missing — proceed with DB delete
    }
    await deleteFactura(Number(id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error en DELETE /api/admin/facturas/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
