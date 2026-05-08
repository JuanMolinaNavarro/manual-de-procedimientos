import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  getContratoCompradorById,
  updateContratoComprador,
  softDeleteContratoComprador,
  deleteContratoComprador,
  getArchivosForContratoComprador,
  type UpdateContratoCompradorData,
} from '@/lib/senales-ip';
import { unlinkSync } from 'fs';
import { join } from 'path';

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get('site_session');
  const role = session?.value?.split('|')[1];
  return role === 'admin';
}

async function getUsername(): Promise<string | null> {
  const cookieStore = await cookies();
  const val = cookieStore.get('site_session')?.value;
  return val ? val.split('|')[0] : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const { id } = await params;
    const contrato = await getContratoCompradorById(Number(id));
    if (!contrato) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json(contrato);
  } catch (error) {
    console.error('Error en GET /api/admin/senales-ip/compradores/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const { id } = await params;
    const contratoId = Number(id);
    if (Number.isNaN(contratoId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }
    const username = await getUsername();
    const body = await request.json() as UpdateContratoCompradorData;
    const updated = await updateContratoComprador(contratoId, { ...body, updated_by: username });
    if (!updated) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error en PUT /api/admin/senales-ip/compradores/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const { id } = await params;
    const contratoId = Number(id);
    if (Number.isNaN(contratoId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }
    const hardDelete = request.nextUrl.searchParams.get('hard') === 'true';
    if (hardDelete) {
      const archivos = await getArchivosForContratoComprador(contratoId);
      for (const a of archivos) {
        try { unlinkSync(join(process.cwd(), 'uploads', 'senales-ip', a.nombre_archivo)); } catch {}
      }
      const ok = await deleteContratoComprador(contratoId);
      if (!ok) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
      return NextResponse.json({ message: 'Contrato eliminado correctamente' });
    }
    const ok = await softDeleteContratoComprador(contratoId);
    if (!ok) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json({ message: 'Contrato desactivado correctamente' });
  } catch (error) {
    console.error('Error en DELETE /api/admin/senales-ip/compradores/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
