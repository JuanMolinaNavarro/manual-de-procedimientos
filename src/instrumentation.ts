export async function register() {
  // Only run in the Node.js runtime (not Edge), and only in production
  // to avoid duplicate schedules during hot reload in development.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { default: cron } = await import('node-cron');
  const { runPipeline, isPipelineRunning } = await import('@/lib/pipeline');
  const { syncSportsData, isSyncRunning } = await import('@/lib/deportes');
  const { sincronizarTodos, isSyncAsistenciaRunning, archivarSilenciosas } = await import('@/lib/asistencia');
  const { DIAS_SILENCIO_DEFAULT } = await import('@/lib/asistencia-datos');

  // 03:10 UTC = 00:10 UTC-3
  cron.schedule('10 3 * * *', async () => {
    if (isPipelineRunning()) {
      console.log('[Pipeline] Cron skipped: already running');
      return;
    }
    console.log('[Pipeline] Cron triggered');
    try {
      const result = await runPipeline();
      console.log('[Pipeline] Cron completed:', JSON.stringify(result));
    } catch (err) {
      console.error('[Pipeline] Cron error:', err);
    }
  }, { timezone: 'UTC' });

  console.log('[Pipeline] Cron scheduled: 03:10 UTC daily (00:10 UTC-3)');

  // Sports sync: 03:00, 09:00, 21:00 UTC = 00:00, 06:00, 18:00 UTC-3
  const sportsCronHandler = async (label: string) => {
    if (isSyncRunning()) {
      console.log(`[Deportes] Cron ${label} skipped: already running`);
      return;
    }
    console.log(`[Deportes] Cron ${label} triggered`);
    try {
      await syncSportsData();
      console.log(`[Deportes] Cron ${label} completed`);
    } catch (err) {
      console.error(`[Deportes] Cron ${label} error:`, err);
    }
  };

  cron.schedule('0 3 * * *',  () => sportsCronHandler('00:00 UTC-3'), { timezone: 'UTC' });
  cron.schedule('0 9 * * *',  () => sportsCronHandler('06:00 UTC-3'), { timezone: 'UTC' });
  cron.schedule('0 21 * * *', () => sportsCronHandler('18:00 UTC-3'), { timezone: 'UTC' });

  console.log('[Deportes] Cron scheduled: 03:00, 09:00, 21:00 UTC (00:00, 06:00, 18:00 UTC-3)');

  // Asistencia: baja las fichadas nuevas de los relojes Anviz cada 10 minutos.
  cron.schedule('*/10 * * * *', async () => {
    if (isSyncAsistenciaRunning()) {
      console.log('[Asistencia] Cron omitido: ya hay una sincronización en curso');
      return;
    }
    try {
      const res = await sincronizarTodos('nuevos');
      const guardados = res.reduce((a, r) => a + r.guardados, 0);
      const conError = res.filter((r) => r.error);
      console.log(`[Asistencia] Cron: ${res.length} relojes, ${guardados} fichadas nuevas` + (conError.length ? `, ${conError.length} con error` : ''));
    } catch (err) {
      console.error('[Asistencia] Cron error:', err);
    }
  }, { timezone: 'UTC' });

  console.log('[Asistencia] Cron scheduled: cada 10 min');

  // Asistencia: archiva a las personas sin vincular que llevan DIAS_SILENCIO_DEFAULT
  // días sin fichar. Una sola vez por día (06:20 UTC = 03:20 UTC-3): es una limpieza
  // de listas, no algo que tenga que reaccionar al minuto. No borra nada — quien
  // vuelva a fichar se reactiva solo. A los vinculados al organigrama no los toca:
  // la baja de un empleado la decide RRHH en su ficha.
  cron.schedule('20 6 * * *', async () => {
    try {
      const r = await archivarSilenciosas(DIAS_SILENCIO_DEFAULT);
      if (r.archivadas > 0) console.log(`[Asistencia] Archivado por silencio: ${r.archivadas} persona(s) sin fichar en ${r.dias} días`);
    } catch (err) {
      console.error('[Asistencia] Cron de archivado error:', err);
    }
  }, { timezone: 'UTC' });

  console.log(`[Asistencia] Cron scheduled: archivado por silencio 06:20 UTC (${DIAS_SILENCIO_DEFAULT} días)`);
}
