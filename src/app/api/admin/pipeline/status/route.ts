import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isPipelineRunning } from '@/lib/pipeline';

export async function GET() {
  const [catalogCount, onDemandCount, lastEntry] = await Promise.all([
    prisma.mwproxyCatalog.count(),
    prisma.onDemand.count(),
    prisma.mwproxyCatalog.findFirst({
      where: { enriched_at: { not: null } },
      orderBy: { enriched_at: 'desc' },
      select: { enriched_at: true },
    }),
  ]);

  return NextResponse.json({
    running: isPipelineRunning(),
    lastRun: lastEntry?.enriched_at ?? null,
    catalogCount,
    onDemandCount,
  });
}
