import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { getArchivoById, deleteArchivoById } from '@/lib/senales-ip';
import { isAdmin } from '@/lib/admin-auth';
import { headersArchivo } from '@/lib/archivos';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const { id } = await params;
    const archivo = await getArchivoById(Number(id));
    if (!archivo) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    const filePath = join(process.cwd(), 'uploads', 'senales-ip', archivo.nombre_archivo);
    let buffer: Buffer;
    try {
      buffer = readFileSync(filePath);
    } catch {
      return NextResponse.json({ error: 'Archivo no encontrado en disco' }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(buffer), {
      headers: headersArchivo(archivo.nombre_archivo, { nombreDescarga: archivo.nombre_original, descargar: true }),
    });
  } catch (error) {
    console.error('Error en GET /api/admin/senales-ip/archivos/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const { id } = await params;
    const archivo = await getArchivoById(Number(id));
    if (!archivo) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    const filePath = join(process.cwd(), 'uploads', 'senales-ip', archivo.nombre_archivo);
    try { unlinkSync(filePath); } catch {}
    await deleteArchivoById(Number(id));
    return NextResponse.json({ message: 'Archivo eliminado correctamente' });
  } catch (error) {
    console.error('Error en DELETE /api/admin/senales-ip/archivos/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
