import { isAdmin } from '@/lib/admin-auth';
import { getConfig, getProyectos } from '@/lib/proyectos';
import ProyectosLista from '@/components/proyectos/ProyectosLista';

export const dynamic = 'force-dynamic';

export default async function ProyectosPage() {
  const [proyectos, config, puedeEditar] = await Promise.all([
    getProyectos(),
    getConfig(),
    isAdmin(),
  ]);

  return <ProyectosLista proyectos={proyectos} config={config} puedeEditar={puedeEditar} />;
}
