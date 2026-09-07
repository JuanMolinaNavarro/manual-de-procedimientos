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
    if (file.size > 60 * 1024 * 1024) throw new AsistenciaError('El archivo supera los 60 MB');
    const buffer = Buffer.from(await file.arrayBuffer());
    return NextResponse.json({ ok: true, ...(await importarMdb(buffer)) });
  });
}
