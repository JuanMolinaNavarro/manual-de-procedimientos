import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { isAdmin, canEditModule } from '@/lib/admin-auth';
import { getDocumentoById, updateDocumento, deleteDocumento } from '@/lib/organigrama';

const DOCS_DIR = join(process.cwd(), 'uploads', 'organigrama', 'documentos');

/** Descarga/visualización del archivo del documento. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const { id } = await params;
  const doc = await getDocumentoById(Number(id));
  if (!doc) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  let buffer: Buffer;
  try {
    buffer = readFileSync(join(DOCS_DIR, doc.nombre_archivo));
  } catch {
    return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
  }
  // filename* (RFC 5987) para nombres con acentos/ñ; filename plano como fallback.
  const ascii = doc.nombre_original.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, "'");
  // Para .pdf forzamos el MIME: si el browser que subió mandó otro tipo (u
  // octet-stream), el lector de PDF del navegador no se activaría al "Ver".
  const mime = doc.nombre_archivo.toLowerCase().endsWith('.pdf')
    ? 'application/pdf'
    : doc.tipo_mime || 'application/octet-stream';
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': mime,
      'Content-Disposition': `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(doc.nombre_original)}`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}

/** Renombrar / recategorizar. */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await canEditModule('organigrama'))) {
      return NextResponse.json({ error: 'Sin permiso de edición' }, { status: 403 });
    }
    const { id } = await params;
    const body = (await request.json()) as { titulo?: string; categoria?: string };
    const titulo = body.titulo?.trim();
    const categoria = body.categoria?.trim();
    const doc = await updateDocumento(Number(id), {
      titulo: titulo || undefined,
      categoria: categoria || undefined,
    });
    if (!doc) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json(doc);
  } catch (error) {
    console.error('Error en PUT /api/admin/organigrama/documentos/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await canEditModule('organigrama'))) {
      return NextResponse.json({ error: 'Sin permiso de edición' }, { status: 403 });
    }
    const { id } = await params;
    const doc = await deleteDocumento(Number(id));
    if (!doc) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    try {
      unlinkSync(join(DOCS_DIR, doc.nombre_archivo));
    } catch {}
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error en DELETE /api/admin/organigrama/documentos/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
