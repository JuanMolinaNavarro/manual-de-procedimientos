/**
 * Acta de adhesión escaneada (PDF) de un trabajador: se sube (reemplaza la
 * anterior), se sirve inline y se puede quitar. El archivo vive en
 * uploads/nomina/actas/<uuid>.pdf; la metadata en NominaAdhesion.
 */

import { NextRequest, NextResponse } from 'next/server';
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createHash, randomUUID } from 'crypto';
import { puedeGestionarPinSesion } from '@/lib/admin-auth';
import { handle, parseId, parseOrgId } from '@/lib/nomina-api';
import { NominaError, clearActa, getAdhesion, setActa } from '@/lib/nomina';
import { ACTAS_DIR, ACTA_MAX_BYTES } from '@/lib/nomina-actas';

type Ctx = { params: Promise<{ empleadoId: string }> };

/** Subir o quitar el acta completa/anula una adhesión: mismo permiso que adherir. */
async function exigirRrhh() {
  if (!(await puedeGestionarPinSesion())) {
    throw new NominaError('Las adhesiones las gestiona RR.HH. (un admin): el superadmin no puede adherir, revocar ni cargar actas', 403);
  }
}

function borrar(archivo: string | null) {
  if (!archivo) return;
  try { unlinkSync(join(ACTAS_DIR, archivo)); } catch { /* puede no existir */ }
}

export async function GET(request: NextRequest, { params }: Ctx) {
  return handle('GET /api/admin/nomina/adhesiones/[empleadoId]/acta', async () => {
    const { empleadoId } = await params;
    const orgId = parseOrgId(request.nextUrl.searchParams.get('organigramaId'));
    const { view, actaArchivo } = await getAdhesion(orgId, parseId(empleadoId, 'empleadoId'));
    if (!actaArchivo || !view.acta) throw new NominaError('Sin acta cargada', 404);
    let buffer: Buffer;
    try {
      buffer = readFileSync(join(ACTAS_DIR, actaArchivo));
    } catch {
      throw new NominaError('El archivo del acta no está disponible', 404);
    }
    const nombre = view.acta.nombreOriginal;
    const ascii = nombre.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, "'");
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  });
}

export async function POST(request: NextRequest, { params }: Ctx) {
  return handle('POST /api/admin/nomina/adhesiones/[empleadoId]/acta', async () => {
    await exigirRrhh();
    const { empleadoId } = await params;
    const formData = await request.formData();
    const orgId = parseOrgId(formData.get('organigramaId') ?? request.nextUrl.searchParams.get('organigramaId'));
    const file = formData.get('archivo');
    if (!(file instanceof File) || !file.size) throw new NominaError('Falta el archivo del acta');
    if (!file.name.toLowerCase().endsWith('.pdf')) throw new NominaError('El acta debe ser un PDF');
    if (file.size > ACTA_MAX_BYTES) throw new NominaError('El PDF supera los 15 MB');
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.subarray(0, 4).toString('latin1') !== '%PDF') throw new NominaError('El archivo no es un PDF válido');

    const storedName = `${randomUUID()}.pdf`;
    mkdirSync(ACTAS_DIR, { recursive: true });
    writeFileSync(join(ACTAS_DIR, storedName), buffer);
    try {
      const { anterior, view } = await setActa(orgId, parseId(empleadoId, 'empleadoId'), {
        archivo: storedName, nombreOriginal: file.name, tamano: buffer.length,
        sha256: createHash('sha256').update(buffer).digest('hex'),
      });
      borrar(anterior);
      return NextResponse.json(view, { status: 201 });
    } catch (e) {
      borrar(storedName);
      throw e;
    }
  });
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  return handle('DELETE /api/admin/nomina/adhesiones/[empleadoId]/acta', async () => {
    await exigirRrhh();
    const { empleadoId } = await params;
    const orgId = parseOrgId(request.nextUrl.searchParams.get('organigramaId'));
    const { anterior } = await clearActa(orgId, parseId(empleadoId, 'empleadoId'));
    borrar(anterior);
    return NextResponse.json({ ok: true });
  });
}
