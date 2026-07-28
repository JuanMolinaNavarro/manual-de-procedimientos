import { notFound } from 'next/navigation';
import { isAdmin } from '@/lib/admin-auth';
import { getConfig, getProyectoById } from '@/lib/proyectos';
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

  const [proyecto, config, puedeEditar] = await Promise.all([
    getProyectoById(proyectoId),
    getConfig(),
    isAdmin(),
  ]);
  if (!proyecto) notFound();

  return (
    <ProyectoDetalle
      proyectoInicial={proyecto}
      configInicial={config}
      puedeEditar={puedeEditar}
    />
  );
}
