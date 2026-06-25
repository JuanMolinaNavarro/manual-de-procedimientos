import { cookies } from 'next/headers';

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
