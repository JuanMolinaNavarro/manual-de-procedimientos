import type { Metadata } from 'next';
import { getAllEmpleados } from '@/lib/organigrama';
import AsistenciaPage from '@/components/asistencia/AsistenciaPage';

export const metadata: Metadata = { title: 'Asistencia' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const empleados = await getAllEmpleados();
  return (
    <AsistenciaPage
      empleados={empleados.map((e) => ({ id: e.id, nombre: e.nombre, rol: e.rol, area: e.area }))}
    />
  );
}
