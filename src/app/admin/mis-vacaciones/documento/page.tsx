import type { Metadata } from 'next';
import { Suspense } from 'react';
import DocumentoVacaciones from '@/components/vacaciones/DocumentoVacaciones';

export const metadata: Metadata = { title: 'Vacaciones · documento' };

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
      <DocumentoVacaciones modo="portal" />
    </Suspense>
  );
}
