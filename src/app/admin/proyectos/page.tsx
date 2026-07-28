import { isAdmin } from '@/lib/admin-auth';
import { getConfig, getProyectos } from '@/lib/proyectos';
import { getAllEmpleados } from '@/lib/organigrama';
import ProyectosLista from '@/components/proyectos/ProyectosLista';

export const dynamic = 'force-dynamic';

export default async function ProyectosPage() {
  const [proyectos, config, empleados, puedeEditar] = await Promise.all([
    getProyectos(),
    getConfig(),
    getAllEmpleados(),
    isAdmin(),
  ]);

  return (
    <ProyectosLista
      proyectos={proyectos}
      config={config}
      empleados={empleados.map((e) => ({ id: e.id, nombre: e.nombre, rol: e.rol }))}
      puedeEditar={puedeEditar}
    />
  );
}
