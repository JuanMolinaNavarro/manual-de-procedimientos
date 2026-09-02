import type { Metadata } from 'next';
import NovedadesPage from '@/components/nomina/NovedadesPage';

export const metadata: Metadata = { title: 'Nómina · Novedades' };

export default function Page() {
  return <NovedadesPage />;
}
