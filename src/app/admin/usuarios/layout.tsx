import { redirect } from 'next/navigation';
import { puedeGestionarUsuariosSesion } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * La gestión de usuarios es solo del superadmin (rol de la base, no de la cookie). El resto
 * vuelve al inicio del panel; la API de `/api/admin/usuarios/**` hace el mismo chequeo.
 */
export default async function UsuariosLayout({ children }: { children: React.ReactNode }) {
  if (!(await puedeGestionarUsuariosSesion())) redirect('/admin');
  return <>{children}</>;
}
