/**
 * `/admin/nomina` no es un módulo en sí: cada pestaña de la nómina es un módulo
 * propio con su permiso. Esta ruta manda al usuario al primer sub-módulo de
 * nómina que tenga habilitado (o al home si no tiene ninguno).
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ADMIN_MODULOS, NOMINA_SLUGS, canAccessPath } from '@/lib/modulos';
import { isSuperadmin } from '@/lib/roles';

export default async function NominaIndexPage() {
  const cookieStore = await cookies();
  const sessionValue = cookieStore.get('site_session')?.value;
  const usuario = sessionValue ? sessionValue.split('|')[0] : null;

  const usuarioRecord = usuario
    ? await prisma.usuario.findUnique({
        where: { usuario },
        select: { modulos: true, rol: true },
      })
    : null;

  const modulos = isSuperadmin(usuarioRecord?.rol) ? [] : usuarioRecord?.modulos ?? [];

  for (const slug of NOMINA_SLUGS) {
    const href = ADMIN_MODULOS.find((m) => m.slug === slug)!.href;
    if (canAccessPath(href, modulos)) redirect(href);
  }
  redirect('/admin');
}
