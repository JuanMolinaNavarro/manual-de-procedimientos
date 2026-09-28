import { NextResponse } from 'next/server';
import { handle } from '@/lib/asistencia-api';
import { AsistenciaError, importarMdb } from '@/lib/asistencia';

export const dynamic = 'force-dynamic';
export const maxDuration = 600;

export async function POST(request: Request) {
  return handle('POST /api/admin/asistencia/importar-mdb', async () => {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new AsistenciaError('No se recibió el archivo');
    if (!/\.(mdb|accdb)$/i.test(file.name)) throw new AsistenciaError('El archivo debe ser .mdb o .accdb');
    // 55 y no 60: el proxy corta el cuerpo en 60 MB y el multipart suma encabezados; un archivo
    // de casi 60 MB llegaba truncado y fallaba como "base inválida".
    if (file.size > 55 * 1024 * 1024) throw new AsistenciaError('El archivo supera los 55 MB');
    const buffer = Buffer.from(await file.arrayBuffer());
    return NextResponse.json({ ok: true, ...(await importarMdb(buffer)) });
  });
}
