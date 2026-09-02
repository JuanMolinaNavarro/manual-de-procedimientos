import type { Metadata } from 'next';
import LiquidacionPage from '@/components/nomina/LiquidacionPage';

export const metadata: Metadata = { title: 'Nómina · Liquidación' };

export default function Page() {
  return <LiquidacionPage />;
}
