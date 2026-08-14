/**
 * Módulo Depósito: no tiene UI propia, es una app externa.
 *
 * Esta ruta existe para que el módulo entre en el mismo esquema de permisos que
 * los demás (`modulos` del usuario, sidebar, home y checkboxes de /admin/usuarios).
 * Verifica el permiso en el server —el AdminModuleGuard es cliente y no llega a
 * correr si redirigimos— y manda al usuario a la app de depósito.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { canAccessPath, DEPOSITO_URL } from '@/lib/modulos';
import { isSuperadmin } from '@/lib/roles';

export default async function DepositoPage() {
  const cookieStore = await cookies();
  const sessionValue = cookieStore.get('site_session')?.value;
  const usuario = sessionValue ? sessionValue.split('|')[0] : null;

  const usuarioRecord = usuario
    ? await prisma.usuario.findUnique({
        where: { usuario },
        select: { modulos: true, rol: true },
      })
    : null;

  // Superadmin ve todos los módulos ([] = sin restricción).
  const modulos = isSuperadmin(usuarioRecord?.rol) ? [] : usuarioRecord?.modulos ?? [];

  if (!canAccessPath('/admin/deposito', modulos)) {
    redirect('/admin');
  }

  redirect(DEPOSITO_URL);
}
