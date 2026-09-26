import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { writeFileSync, mkdirSync, unlinkSync, readFileSync } from 'fs';
import { join } from 'path';
import { EXT_POR_MIME_IMAGEN, headersArchivo } from '@/lib/archivos';
import { getContratoVendedorById, setLogoVendedor } from '@/lib/senales-ip';
import { isAdmin } from '@/lib/admin-auth';

const LOGO_DIR = join(process.cwd(), 'uploads', 'senales-ip', 'logos');
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdmin()) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const { id } = await params;
  const contrato = await getContratoVendedorById(Number(id));
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
  return new NextResponse(new Uint8Array(buffer), { headers: headersArchivo(contrato.logo_nombre_archivo) });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdmin()) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const { id } = await params;
  const contratoId = Number(id);
  const contrato = await getContratoVendedorById(contratoId);
  if (!contrato) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get('logo') as File | null;
  if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 });
  // La extensión la decide el servidor según el tipo aceptado (no el nombre que mandó el cliente).
  const ext = EXT_POR_MIME_IMAGEN[file.type];
  if (!ext) {
    return NextResponse.json({ error: 'Tipo de archivo no permitido. Use PNG, JPG, WebP o SVG.' }, { status: 400 });
  }
  if (file.size > LOGO_MAX_BYTES) {
    return NextResponse.json({ error: 'El logo no puede superar 2 MB' }, { status: 400 });
  }

  if (contrato.logo_nombre_archivo) {
    try { unlinkSync(join(LOGO_DIR, contrato.logo_nombre_archivo)); } catch {}
  }

  const storedName = `${randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  mkdirSync(LOGO_DIR, { recursive: true });
  writeFileSync(join(LOGO_DIR, storedName), buffer);
  await setLogoVendedor(contratoId, storedName);

  return NextResponse.json({ logo_nombre_archivo: storedName }, { status: 200 });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdmin()) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const { id } = await params;
  const contratoId = Number(id);
  const contrato = await getContratoVendedorById(contratoId);
  if (!contrato) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  if (contrato.logo_nombre_archivo) {
    try { unlinkSync(join(LOGO_DIR, contrato.logo_nombre_archivo)); } catch {}
  }
  await setLogoVendedor(contratoId, null);
  return NextResponse.json({ ok: true });
}
