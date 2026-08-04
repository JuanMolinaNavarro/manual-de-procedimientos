import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { readFileSync } from 'fs';
import { join, extname } from 'path';
import { getContratoCompradorById, setLogoComprador } from '@/lib/senales-ip';
import { isAdminRole } from '@/lib/roles';

const LOGO_DIR = join(process.cwd(), 'uploads', 'senales-ip', 'logos');
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif'];

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get('site_session');
  const role = session?.value?.split('|')[1];
  return isAdminRole(role);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdmin()) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const { id } = await params;
  const contrato = await getContratoCompradorById(Number(id));
  if (!contrato?.logo_nombre_archivo) {
    return NextResponse.json({ error: 'Sin logo' }, { status: 404 });
  }
  const filePath = join(LOGO_DIR, contrato.logo_nombre_archivo);
  let buffer: Buffer;
  try {
    buffer = readFileSync(filePath);
  } catch {
    return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
  }
  const ext = contrato.logo_nombre_archivo.split('.').pop() ?? 'png';
  const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: { 'Content-Type': mime, 'Cache-Control': 'public, max-age=3600' },
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdmin()) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const { id } = await params;
  const contratoId = Number(id);
  const contrato = await getContratoCompradorById(contratoId);
  if (!contrato) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get('logo') as File | null;
  if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Tipo de archivo no permitido. Use PNG, JPG, WebP o SVG.' }, { status: 400 });
  }

  // Remove old logo file if exists
  if (contrato.logo_nombre_archivo) {
    try { unlinkSync(join(LOGO_DIR, contrato.logo_nombre_archivo)); } catch {}
  }

  const ext = extname(file.name) || `.${file.type.split('/')[1]}`;
  const storedName = `${randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  mkdirSync(LOGO_DIR, { recursive: true });
  writeFileSync(join(LOGO_DIR, storedName), buffer);
  await setLogoComprador(contratoId, storedName);

  return NextResponse.json({ logo_nombre_archivo: storedName }, { status: 200 });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdmin()) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const { id } = await params;
  const contratoId = Number(id);
  const contrato = await getContratoCompradorById(contratoId);
  if (!contrato) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  if (contrato.logo_nombre_archivo) {
    try { unlinkSync(join(LOGO_DIR, contrato.logo_nombre_archivo)); } catch {}
  }
  await setLogoComprador(contratoId, null);
  return NextResponse.json({ ok: true });
}
