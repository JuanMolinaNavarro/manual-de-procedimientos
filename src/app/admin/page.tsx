import { getSesion } from '@/lib/admin-auth';
import { getModulosForUser, modulosEfectivos } from '@/lib/modulos';
import { isEmpleadoRole } from '@/lib/roles';
import AdminHomeModulos from '@/components/AdminHomeModulos';
import CumplesBanner from '@/components/CumplesBanner';

export default async function AdminHomePage() {
  const usuarioRecord = await getSesion();

  const modulos = modulosEfectivos(usuarioRecord?.rol, usuarioRecord?.modulos);
  // El empleado no ve el banner de cumpleaños: lista gente de todo el organigrama.
  const esEmpleado = isEmpleadoRole(usuarioRecord?.rol);
  const allowedModules = getModulosForUser(modulos);

  const nombreCompleto = usuarioRecord
    ? [usuarioRecord.nombre, usuarioRecord.apellido].filter(Boolean).join(' ').trim() || usuarioRecord.usuario
    : null;

  return (
    <div className="space-y-8">
      {!esEmpleado && <CumplesBanner />}
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          Bienvenido{nombreCompleto ? `, ${nombreCompleto}` : ''}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {esEmpleado ? 'Consultá tu asistencia y tus recibos de sueldo.' : 'Seleccioná una categoría para comenzar.'}
        </p>
      </div>

      <AdminHomeModulos modulos={allowedModules.map((m) => ({ ...m }))} sinCategorias={esEmpleado} />
    </div>
  );
}
