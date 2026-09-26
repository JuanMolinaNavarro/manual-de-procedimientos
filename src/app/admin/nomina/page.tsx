/**
 * `/admin/nomina` no es un módulo en sí: cada pestaña de la nómina es un módulo
 * propio con su permiso. Esta ruta manda al usuario al primer sub-módulo de
 * nómina que tenga habilitado (o al home si no tiene ninguno).
 */

import { redirect } from 'next/navigation';
import { getSesion } from '@/lib/admin-auth';
import { ADMIN_MODULOS, NOMINA_SLUGS, canAccessPath, modulosEfectivos } from '@/lib/modulos';

export default async function NominaIndexPage() {
  const usuarioRecord = await getSesion();

  const modulos = modulosEfectivos(usuarioRecord?.rol, usuarioRecord?.modulos);

  for (const slug of NOMINA_SLUGS) {
    const href = ADMIN_MODULOS.find((m) => m.slug === slug)!.href;
    if (canAccessPath(href, modulos)) redirect(href);
  }
  redirect('/admin');
}
