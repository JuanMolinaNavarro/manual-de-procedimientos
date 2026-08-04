import { notFound } from 'next/navigation';
import { isAdmin, getScopeProyectos } from '@/lib/admin-auth';
import { getConfig, getProyectoVisible } from '@/lib/proyectos';
import { getAllAreas, getAllEmpleados } from '@/lib/organigrama';
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

  const scope = await getScopeProyectos();
  const [proyecto, config, empleados, areas, puedeEditar] = await Promise.all([
    getProyectoVisible(proyectoId, scope),
    getConfig(),
    getAllEmpleados(),
    getAllAreas(),
    isAdmin(),
  ]);
  if (!proyecto) notFound();

  return (
    <ProyectoDetalle
      proyectoInicial={proyecto}
      configInicial={config}
      empleados={empleados.map((e) => ({ id: e.id, nombre: e.nombre, rol: e.rol }))}
      areas={areas.map((a) => a.nombre)}
      puedeCambiarArea={scope.tipo === 'todos'}
      puedeEditar={puedeEditar}
    />
  );
}
