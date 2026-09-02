import type { Metadata } from 'next';
import TableroPage from '@/components/nomina/TableroPage';

export const metadata: Metadata = { title: 'Nómina · Tablero' };

export default function Page() {
  return <TableroPage />;
}
