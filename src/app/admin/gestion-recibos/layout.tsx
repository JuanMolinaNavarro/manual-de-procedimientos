import { getSesion } from '@/lib/admin-auth';
import { puedeGestionarPin } from '@/lib/roles';
import { getAllOrganigramas } from '@/lib/organigrama';
import { NominaProvider } from '@/components/nomina/NominaContext';

export const dynamic = 'force-dynamic';

/**
 * Gestión de recibos (RR.HH.): módulo propio, fuera de Nómina. Reusa el contexto de nómina
 * (empresa y período, compartidos con Nómina vía localStorage) pero sin su barra ni pestañas:
 * la página tiene su propio encabezado.
 */
export default async function GestionRecibosLayout({ children }: { children: React.ReactNode }) {
  const usuarioRecord = await getSesion();
  const organigramas = (await getAllOrganigramas()).map((o) => ({ id: o.id, nombre: o.nombre }));

  return (
    <NominaProvider organigramas={organigramas} links={[]} barra={false} puedeGestionarPin={puedeGestionarPin(usuarioRecord?.rol)}>
      {children}
    </NominaProvider>
  );
}
