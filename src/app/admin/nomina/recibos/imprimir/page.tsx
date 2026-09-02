import type { Metadata } from 'next';
import { Suspense } from 'react';
import ReciboImprimible from '@/components/nomina/ReciboImprimible';

export const metadata: Metadata = { title: 'Recibo de haberes' };

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
      <ReciboImprimible />
    </Suspense>
  );
}
