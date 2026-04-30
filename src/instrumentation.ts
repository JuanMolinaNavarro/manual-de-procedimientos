export async function register() {
  // Only run in the Node.js runtime (not Edge), and only in production
  // to avoid duplicate schedules during hot reload in development.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { default: cron } = await import('node-cron');
  const { runPipeline, isPipelineRunning } = await import('@/lib/pipeline');
  const { syncSportsData, isSyncRunning } = await import('@/lib/deportes');

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
}
