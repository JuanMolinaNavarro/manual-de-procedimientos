import { NextRequest, NextResponse } from 'next/server';
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
import { getSessionUsername, isAdmin } from '@/lib/admin-auth';

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
    const username = await getSessionUsername();
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
      // Primero la base y después los archivos: si el borrado en la base falla, no quedan
      // filas apuntando a archivos que ya no existen.
      const ok = await deleteContratoComprador(contratoId);
      if (!ok) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
      for (const a of archivos) {
        try { unlinkSync(join(process.cwd(), 'uploads', 'senales-ip', a.nombre_archivo)); } catch {}
      }
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
