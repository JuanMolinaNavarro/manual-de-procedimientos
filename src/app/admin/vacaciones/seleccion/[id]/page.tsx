import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import CargarFechasPage from '@/components/vacaciones/CargarFechasPage';

export const metadata: Metadata = { title: 'Vacaciones · cargar fechas' };
export const dynamic = 'force-dynamic';

/** RR.HH. carga las fechas de una persona (mismo calendario que Mis vacaciones). */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return (
    <div className="mx-auto w-full max-w-6xl">
      <CargarFechasPage empleadoId={id} />
    </div>
  );
}
