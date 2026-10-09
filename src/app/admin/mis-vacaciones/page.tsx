import type { Metadata } from 'next';
import MisVacacionesPage from '@/components/vacaciones/MisVacacionesPage';

export const metadata: Metadata = { title: 'Mis vacaciones' };
export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <MisVacacionesPage />
    </div>
  );
}
