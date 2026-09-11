import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { canEditModule } from '@/lib/admin-auth';
import { getLicenciaById } from '@/lib/organigrama';
import { LICENCIAS_DIR, mimeDeIcono } from '@/lib/licencias-icono';

/** Sirve el ícono (favicon descargado o imagen subida) de la licencia. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await canEditModule('organigrama'))) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }
  const { id } = await params;
  const licencia = await getLicenciaById(Number(id));
  if (!licencia?.icono_archivo) {
    return NextResponse.json({ error: 'Sin ícono' }, { status: 404 });
  }
  let buffer: Buffer;
  try {
    buffer = readFileSync(join(LICENCIAS_DIR, licencia.icono_archivo));
  } catch {
    return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': mimeDeIcono(licencia.icono_archivo),
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
