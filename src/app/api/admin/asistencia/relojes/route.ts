import { NextResponse } from 'next/server';
import { handle, readJson } from '@/lib/asistencia-api';
import { crearReloj, listarRelojes, type DatosReloj } from '@/lib/asistencia';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handle('GET /api/admin/asistencia/relojes', async () =>
    NextResponse.json({ relojes: await listarRelojes() }),
  );
}

export async function POST(request: Request) {
  return handle('POST /api/admin/asistencia/relojes', async () => {
    const b = await readJson(request);
    const reloj = await crearReloj({
      nombre: String(b.nombre ?? ''),
      ip: String(b.ip ?? ''),
      puerto: b.puerto != null ? Number(b.puerto) : undefined,
      device_id: Number(b.device_id),
      activo: b.activo == null ? undefined : Boolean(b.activo),
      limpiar_nuevos: b.limpiar_nuevos == null ? undefined : Boolean(b.limpiar_nuevos),
    } as DatosReloj);
    return NextResponse.json({ ok: true, reloj });
  });
}
