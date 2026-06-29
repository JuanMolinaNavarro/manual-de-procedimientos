import { cookies } from 'next/headers';
import { prisma } from './prisma';
import { canEditModule as slugEditable, type AdminModuloSlug } from './modulos';

/** ¿La sesión actual es de un usuario con rol admin? */
export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  const role = store.get('site_session')?.value?.split('|')[1];
  return role === 'admin';
}

/** Nombre de usuario de la sesión actual (para created_by/updated_by). */
export async function getSessionUsername(): Promise<string | null> {
  const store = await cookies();
  const val = store.get('site_session')?.value;
  return val ? val.split('|')[0] : null;
}

/**
 * ¿El usuario de la sesión puede EDITAR el módulo dado? Requiere rol admin y que el
 * slug esté en su lista `modulos_edit`. A diferencia de `isAdmin()` (que solo mira el
 * cookie), esto consulta la DB porque el permiso de edición es por usuario.
 */
export async function canEditModule(slug: AdminModuloSlug): Promise<boolean> {
  const store = await cookies();
  const val = store.get('site_session')?.value;
  if (!val) return false;
  const [usuario, rol] = val.split('|');
  if (rol !== 'admin' || !usuario) return false;
  const record = await prisma.usuario.findUnique({
    where: { usuario },
    select: { rol: true, modulos_edit: true },
  });
  if (!record || record.rol !== 'admin') return false;
  return slugEditable(slug, record.modulos_edit);
}
