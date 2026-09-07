import { handle, parseFiltros } from '@/lib/asistencia-api';
import { exportarXlsx } from '@/lib/asistencia';

export const dynamic = 'force-dynamic';
export const maxDuration = 600;

export async function GET(request: Request) {
  return handle('GET /api/admin/asistencia/fichadas/export', async () => {
    const f = parseFiltros(new URL(request.url));
    const buf = await exportarXlsx(f);
    const nombre = `asistencia_${f.desde}_a_${f.hasta}.xlsx`;
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${nombre}"`,
      },
    });
  });
}
