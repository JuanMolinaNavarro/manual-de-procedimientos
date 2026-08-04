import { isAdmin, getScopeProyectos } from '@/lib/admin-auth';
import { getConfig, getProyectos } from '@/lib/proyectos';
import { getAllAreas, getAllEmpleados } from '@/lib/organigrama';
import ProyectosLista from '@/components/proyectos/ProyectosLista';

export const dynamic = 'force-dynamic';

export default async function ProyectosPage() {
  const scope = await getScopeProyectos();
  const [proyectos, config, empleados, areas, puedeEditar] = await Promise.all([
    getProyectos(scope),
    getConfig(),
    getAllEmpleados(),
    getAllAreas(),
    isAdmin(),
  ]);

  return (
    <ProyectosLista
      proyectos={proyectos}
      config={config}
      empleados={empleados.map((e) => ({ id: e.id, nombre: e.nombre, rol: e.rol }))}
      areas={areas.map((a) => a.nombre)}
      scope={scope}
      puedeEditar={puedeEditar}
    />
  );
}
