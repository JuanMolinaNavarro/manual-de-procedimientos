/**
 * Módulo Depósito: no tiene UI propia, es una app externa.
 *
 * Esta ruta existe para que el módulo entre en el mismo esquema de permisos que
 * los demás (`modulos` del usuario, sidebar, home y checkboxes de /admin/usuarios).
 * Verifica el permiso en el server —el AdminModuleGuard es cliente y no llega a
 * correr si redirigimos— y manda al usuario a la app de depósito.
 */

import { redirect } from 'next/navigation';
import { getSesion } from '@/lib/admin-auth';
import { canAccessPath, DEPOSITO_URL, modulosEfectivos } from '@/lib/modulos';

export default async function DepositoPage() {
  const usuarioRecord = await getSesion();

  // Superadmin ve todos los módulos ([] = sin restricción).
  const modulos = modulosEfectivos(usuarioRecord?.rol, usuarioRecord?.modulos);

  if (!canAccessPath('/admin/deposito', modulos)) {
    redirect('/admin');
  }

  redirect(DEPOSITO_URL);
}
