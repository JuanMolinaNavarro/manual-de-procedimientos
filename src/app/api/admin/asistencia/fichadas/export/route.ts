import { handle, parseFiltros } from '@/lib/asistencia-api';
import { AsistenciaError, exportarXlsx } from '@/lib/asistencia';

/** Tope del rango exportable: sin él, `desde=2000-01-01` armaba toda la tabla en memoria. */
const MAX_DIAS_EXPORT = 366;

export const dynamic = 'force-dynamic';
export const maxDuration = 600;

export async function GET(request: Request) {
  return handle('GET /api/admin/asistencia/fichadas/export', async () => {
    const f = parseFiltros(new URL(request.url));
    const dias = (Date.parse(f.hasta) - Date.parse(f.desde)) / 86_400_000 + 1;
    if (!f.soloSospechosas && dias > MAX_DIAS_EXPORT) {
      throw new AsistenciaError(`El rango a exportar no puede superar ${MAX_DIAS_EXPORT} días`);
    }
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
