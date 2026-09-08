import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getAllEmpleados } from '@/lib/organigrama';
import AsistenciaPage from '@/components/asistencia/AsistenciaPage';

export const metadata: Metadata = { title: 'Asistencia' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const empleados = await getAllEmpleados();
  const opciones = empleados.map((e) => ({
    id: e.id,
    nombre: e.nombre,
    rol: e.rol,
    area: e.area,
    foto_archivo: e.foto_archivo,
  }));

  // Los filtros viven en la URL y `useSearchParams` lo exige.
  return (
    <Suspense fallback={null}>
      <AsistenciaPage empleados={opciones} />
    </Suspense>
  );
}
