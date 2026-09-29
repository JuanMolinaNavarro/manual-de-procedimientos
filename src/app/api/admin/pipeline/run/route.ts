import { NextResponse } from 'next/server';
import { runPipeline, isPipelineRunning } from '@/lib/pipeline';
import { handleAdmin } from '@/lib/api-admin';

export async function POST() {
  return handleAdmin('POST /api/admin/pipeline/run', async () => {
    if (isPipelineRunning()) {
      return NextResponse.json({ error: 'El pipeline ya está en ejecución' }, { status: 409 });
    }
    return NextResponse.json(await runPipeline());
  });
}
