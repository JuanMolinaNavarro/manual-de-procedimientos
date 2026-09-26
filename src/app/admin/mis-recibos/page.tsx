import type { Metadata } from 'next';
import MisRecibosPage from '@/components/nomina/MisRecibosPage';

export const metadata: Metadata = { title: 'Recibos' };
export const dynamic = 'force-dynamic';

export default function Page() {
  return <MisRecibosPage />;
}
