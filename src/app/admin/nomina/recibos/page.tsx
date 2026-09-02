import type { Metadata } from 'next';
import RecibosPage from '@/components/nomina/RecibosPage';

export const metadata: Metadata = { title: 'Nómina · Recibos' };

export default function Page() {
  return <RecibosPage />;
}
