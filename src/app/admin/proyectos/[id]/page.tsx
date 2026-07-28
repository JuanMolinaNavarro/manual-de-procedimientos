import { notFound } from 'next/navigation';
import { isAdmin } from '@/lib/admin-auth';
import { getConfig, getProyectoById } from '@/lib/proyectos';
import { getAllEmpleados } from '@/lib/organigrama';
import ProyectoDetalle from '@/components/proyectos/ProyectoDetalle';

export const dynamic = 'force-dynamic';

export default async function ProyectoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const proyectoId = Number(id);
  if (Number.isNaN(proyectoId)) notFound();

  const [proyecto, config, empleados, puedeEditar] = await Promise.all([
    getProyectoById(proyectoId),
    getConfig(),
    getAllEmpleados(),
    isAdmin(),
  ]);
  if (!proyecto) notFound();

  return (
    <ProyectoDetalle
      proyectoInicial={proyecto}
      configInicial={config}
      empleados={empleados.map((e) => ({ id: e.id, nombre: e.nombre, rol: e.rol }))}
      puedeEditar={puedeEditar}
    />
  );
}
