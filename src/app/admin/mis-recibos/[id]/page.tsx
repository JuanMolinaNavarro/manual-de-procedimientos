import type { Metadata } from 'next';
import FirmarReciboPage from '@/components/nomina/FirmarReciboPage';

export const metadata: Metadata = { title: 'Firmar recibo' };
export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FirmarReciboPage id={id} />;
}
