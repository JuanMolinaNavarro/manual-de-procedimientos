import type { Metadata } from 'next';
import { Suspense } from 'react';
import VacacionesPage from '@/components/vacaciones/VacacionesPage';

export const metadata: Metadata = { title: 'Vacaciones' };
export const dynamic = 'force-dynamic';

export default function Page() {
  // La pestaña vive en la URL (`?tab=`) y `useSearchParams` lo exige.
  return (
    <Suspense fallback={null}>
      <VacacionesPage />
    </Suspense>
  );
}
