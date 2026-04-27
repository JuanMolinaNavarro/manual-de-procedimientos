export async function register() {
  // Only run in the Node.js runtime (not Edge), and only in production
  // to avoid duplicate schedules during hot reload in development.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { default: cron } = await import('node-cron');
  const { runPipeline, isPipelineRunning } = await import('@/lib/pipeline');

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
}
