import { getSesion } from '@/lib/admin-auth';
import { ADMIN_MODULOS, NOMINA_SLUGS, getModulosForUser, modulosEfectivos } from '@/lib/modulos';
import { puedeGestionarPin } from '@/lib/roles';
import { getAllOrganigramas } from '@/lib/organigrama';
import { NominaProvider } from '@/components/nomina/NominaContext';

export const dynamic = 'force-dynamic';

export default async function NominaLayout({ children }: { children: React.ReactNode }) {
  const usuarioRecord = await getSesion();
  const modulos = modulosEfectivos(usuarioRecord?.rol, usuarioRecord?.modulos);
  const permitidos = new Set(getModulosForUser(modulos).map((m) => m.slug));
  const links = NOMINA_SLUGS.filter((s) => permitidos.has(s)).map((s) => {
    const m = ADMIN_MODULOS.find((x) => x.slug === s)!;
    return { slug: m.slug, label: m.label, href: m.href };
  });
  const organigramas = (await getAllOrganigramas()).map((o) => ({ id: o.id, nombre: o.nombre }));

  return (
    <NominaProvider organigramas={organigramas} links={links} puedeGestionarPin={puedeGestionarPin(usuarioRecord?.rol)}>
      {children}
    </NominaProvider>
  );
}
