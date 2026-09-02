import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { ADMIN_MODULOS, NOMINA_SLUGS, getModulosForUser } from '@/lib/modulos';
import { isSuperadmin } from '@/lib/roles';
import { getAllOrganigramas } from '@/lib/organigrama';
import { NominaProvider } from '@/components/nomina/NominaContext';

export const dynamic = 'force-dynamic';

export default async function NominaLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const sessionValue = cookieStore.get('site_session')?.value;
  const usuario = sessionValue ? sessionValue.split('|')[0] : null;
  const usuarioRecord = usuario
    ? await prisma.usuario.findUnique({ where: { usuario }, select: { modulos: true, rol: true } })
    : null;
  const modulos = isSuperadmin(usuarioRecord?.rol) ? [] : usuarioRecord?.modulos ?? [];
  const permitidos = new Set(getModulosForUser(modulos).map((m) => m.slug));
  const links = NOMINA_SLUGS.filter((s) => permitidos.has(s)).map((s) => {
    const m = ADMIN_MODULOS.find((x) => x.slug === s)!;
    return { slug: m.slug, label: m.label, href: m.href };
  });
  const organigramas = (await getAllOrganigramas()).map((o) => ({ id: o.id, nombre: o.nombre }));

  return (
    <NominaProvider organigramas={organigramas} links={links}>
      {children}
    </NominaProvider>
  );
}
