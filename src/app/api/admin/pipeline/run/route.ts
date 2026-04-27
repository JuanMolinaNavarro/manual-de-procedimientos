import { NextResponse } from 'next/server';
import { runPipeline, isPipelineRunning } from '@/lib/pipeline';

export async function POST() {
  if (isPipelineRunning()) {
    return NextResponse.json({ error: 'El pipeline ya está en ejecución' }, { status: 409 });
  }

  try {
    const result = await runPipeline();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
