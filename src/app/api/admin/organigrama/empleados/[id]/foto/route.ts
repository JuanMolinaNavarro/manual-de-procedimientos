import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { writeFileSync, mkdirSync, unlinkSync, readFileSync } from 'fs';
import { join, extname } from 'path';
import { isAdmin, canEditModule } from '@/lib/admin-auth';
import { getEmpleadoById, setFotoEmpleado } from '@/lib/organigrama';

const FOTO_DIR = join(process.cwd(), 'uploads', 'organigrama', 'fotos');
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const { id } = await params;
  const empleado = await getEmpleadoById(Number(id));
  if (!empleado?.foto_archivo) {
    return NextResponse.json({ error: 'Sin foto' }, { status: 404 });
  }
  const filePath = join(FOTO_DIR, empleado.foto_archivo);
  let buffer: Buffer;
  try {
    buffer = readFileSync(filePath);
  } catch {
    return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
  }
  const ext = empleado.foto_archivo.split('.').pop() ?? 'png';
  const mime = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: { 'Content-Type': mime, 'Cache-Control': 'public, max-age=3600' },
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await canEditModule('organigrama'))) {
    return NextResponse.json({ error: 'Sin permiso de edición' }, { status: 403 });
  }
  const { id } = await params;
  const empleadoId = Number(id);
  const empleado = await getEmpleadoById(empleadoId);
  if (!empleado) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get('foto') as File | null;
  if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Tipo de archivo no permitido. Use PNG, JPG, WebP o GIF.' },
      { status: 400 },
    );
  }

  // Borrar la foto anterior si existía.
  if (empleado.foto_archivo) {
    try {
      unlinkSync(join(FOTO_DIR, empleado.foto_archivo));
    } catch {}
  }

  const ext = extname(file.name) || `.${file.type.split('/')[1]}`;
  const storedName = `${randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  mkdirSync(FOTO_DIR, { recursive: true });
  writeFileSync(join(FOTO_DIR, storedName), buffer);
  await setFotoEmpleado(empleadoId, storedName);

  return NextResponse.json({ foto_archivo: storedName }, { status: 200 });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await canEditModule('organigrama'))) {
    return NextResponse.json({ error: 'Sin permiso de edición' }, { status: 403 });
  }
  const { id } = await params;
  const empleadoId = Number(id);
  const empleado = await getEmpleadoById(empleadoId);
  if (!empleado) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  if (empleado.foto_archivo) {
    try {
      unlinkSync(join(FOTO_DIR, empleado.foto_archivo));
    } catch {}
  }
  await setFotoEmpleado(empleadoId, null);
  return NextResponse.json({ ok: true });
}
