import type { Metadata } from 'next';
import GestionRecibosPage from '@/components/nomina/GestionRecibosPage';

export const metadata: Metadata = { title: 'Gestión de recibos' };

export default function Page() {
  return <GestionRecibosPage />;
}
