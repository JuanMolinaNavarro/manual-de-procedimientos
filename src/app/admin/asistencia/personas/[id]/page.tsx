import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getAllEmpleados } from '@/lib/organigrama';
import { AsistenciaProvider } from '@/components/asistencia/AsistenciaContext';
import PerfilPersonaPage from '@/components/asistencia/PerfilPersonaPage';

export const metadata: Metadata = { title: 'Perfil de asistencia' };
export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const personaId = Number(id);
  if (!Number.isInteger(personaId) || personaId <= 0) notFound();

  const empleados = await getAllEmpleados();
  const opciones = empleados.map((e) => ({ id: e.id, nombre: e.nombre, rol: e.rol, area: e.area, foto_archivo: e.foto_archivo }));

  // El mes vive en la URL (`?mes=`) y el provider usa `useSearchParams`.
  return (
    <Suspense fallback={null}>
      <AsistenciaProvider empleados={opciones}>
        <PerfilPersonaPage personaId={personaId} />
      </AsistenciaProvider>
    </Suspense>
  );
}
