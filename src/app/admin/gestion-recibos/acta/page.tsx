import type { Metadata } from 'next';
import { Suspense } from 'react';
import ActaAdhesion from '@/components/nomina/ActaAdhesion';

export const metadata: Metadata = { title: 'Acta de adhesión' };

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
      <ActaAdhesion />
    </Suspense>
  );
}
