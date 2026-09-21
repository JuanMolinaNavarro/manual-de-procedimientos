import type { Metadata } from 'next';
import MiAsistenciaPage from '@/components/asistencia/MiAsistenciaPage';

export const metadata: Metadata = { title: 'Mi asistencia' };
export const dynamic = 'force-dynamic';

export default function Page() {
  return <MiAsistenciaPage />;
}
