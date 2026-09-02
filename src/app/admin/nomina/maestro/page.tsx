import type { Metadata } from 'next';
import MaestroPage from '@/components/nomina/MaestroPage';

export const metadata: Metadata = { title: 'Nómina · Maestro' };

export default function Page() {
  return <MaestroPage />;
}
