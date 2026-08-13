import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import { join, extname } from 'path';
import { isAdmin, canEditModule, getSessionUsername } from '@/lib/admin-auth';
import { getEmpleadoById, getDocumentosDeEmpleado, createDocumento } from '@/lib/organigrama';

const DOCS_DIR = join(process.cwd(), 'uploads', 'organigrama', 'documentos');

// Whitelist por extensión (el MIME que manda el browser es poco confiable para
// los formatos de Office): documentos de procedimientos típicos + imágenes.
const ALLOWED_EXTS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.odt', '.ods', '.txt', '.md', '.csv',
  '.png', '.jpg', '.jpeg', '.webp', '.gif',
];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const { id } = await params;
  const empleadoId = Number(id);
  if (Number.isNaN(empleadoId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }
  return NextResponse.json(await getDocumentosDeEmpleado(empleadoId));
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await canEditModule('organigrama'))) {
      return NextResponse.json({ error: 'Sin permiso de edición' }, { status: 403 });
    }
    const { id } = await params;
    const empleadoId = Number(id);
    const empleado = await getEmpleadoById(empleadoId);
    if (!empleado) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const formData = await request.formData();
    const file = formData.get('archivo') as File | null;
    if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 });

    const ext = extname(file.name).toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      return NextResponse.json(
        { error: `Tipo de archivo no permitido (${ext || 'sin extensión'}). Use PDF, Office, texto o imágenes.` },
        { status: 400 },
      );
    }

    const categoria = String(formData.get('categoria') ?? '').trim() || 'General';
    // Título por defecto: el nombre original sin extensión.
    const titulo =
      String(formData.get('titulo') ?? '').trim() || file.name.replace(/\.[^.]+$/, '');

    const storedName = `${randomUUID()}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    mkdirSync(DOCS_DIR, { recursive: true });
    writeFileSync(join(DOCS_DIR, storedName), buffer);

    const doc = await createDocumento({
      empleado_id: empleadoId,
      categoria,
      titulo,
      nombre_original: file.name,
      nombre_archivo: storedName,
      tipo_mime: file.type || null,
      tamano: buffer.length,
      created_by: await getSessionUsername(),
    });
    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    console.error('Error en POST /api/admin/organigrama/empleados/[id]/documentos:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
