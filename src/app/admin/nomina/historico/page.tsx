import type { Metadata } from 'next';
import HistoricoPage from '@/components/nomina/HistoricoPage';

export const metadata: Metadata = { title: 'Nómina · Histórico' };

export default function Page() {
  return <HistoricoPage />;
}
