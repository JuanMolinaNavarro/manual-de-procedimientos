import type { Metadata } from 'next';
import ParametrosPage from '@/components/nomina/ParametrosPage';

export const metadata: Metadata = { title: 'Nómina · Parámetros' };

export default function Page() {
  return <ParametrosPage />;
}
