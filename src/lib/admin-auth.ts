import { cookies } from 'next/headers';
import { prisma } from './prisma';
import { canEditModule as slugEditable, type AdminModuloSlug } from './modulos';
import { isAdminRole, isSuperadmin } from './roles';

/** ¿La sesión actual es de un usuario con rol admin o superadmin? */
export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  const role = store.get('site_session')?.value?.split('|')[1];
  return isAdminRole(role);
}

/** Nombre de usuario de la sesión actual (para created_by/updated_by). */
export async function getSessionUsername(): Promise<string | null> {
  const store = await cookies();
  const val = store.get('site_session')?.value;
  return val ? val.split('|')[0] : null;
}

/**
 * Registro completo (DB) del usuario de la sesión, con su ficha del organigrama.
 * Consulta la DB porque el rol de la cookie puede estar viejo (se fija al login).
 */
export async function getUsuarioSesion() {
  const store = await cookies();
  const val = store.get('site_session')?.value;
  const usuario = val ? val.split('|')[0] : null;
  if (!usuario) return null;
  return prisma.usuario.findUnique({
    where: { usuario },
    include: { empleado: { select: { id: true, nombre: true, area: true } } },
  });
}

/**
 * ¿El usuario de la sesión puede EDITAR el módulo dado? Superadmin siempre puede.
 * Para admin requiere que el slug esté en su lista `modulos_edit`. A diferencia de
 * `isAdmin()` (que solo mira el cookie), esto consulta la DB porque el permiso de
 * edición es por usuario.
 */
export async function canEditModule(slug: AdminModuloSlug): Promise<boolean> {
  const store = await cookies();
  const val = store.get('site_session')?.value;
  if (!val) return false;
  const [usuario, rol] = val.split('|');
  if (!isAdminRole(rol) || !usuario) return false;
  const record = await prisma.usuario.findUnique({
    where: { usuario },
    select: { rol: true, modulos_edit: true },
  });
  if (!record || !isAdminRole(record.rol)) return false;
  if (isSuperadmin(record.rol)) return true;
  return slugEditable(slug, record.modulos_edit);
}

/**
 * Qué proyectos puede ver el usuario de la sesión:
 * - superadmin → todos.
 * - admin vinculado a una ficha del organigrama → solo los de su área.
 * - admin sin vincular → ninguno.
 */
export type ScopeProyectos =
  | { tipo: 'todos' }
  | { tipo: 'area'; area: string }
  | { tipo: 'ninguno' };

export async function getScopeProyectos(): Promise<ScopeProyectos> {
  const record = await getUsuarioSesion();
  if (!record || !isAdminRole(record.rol)) return { tipo: 'ninguno' };
  if (isSuperadmin(record.rol)) return { tipo: 'todos' };
  if (record.empleado?.area) return { tipo: 'area', area: record.empleado.area };
  return { tipo: 'ninguno' };
}

/** ¿El scope cubre un proyecto con esta área? */
export function scopeCubreArea(scope: ScopeProyectos, area: string | null): boolean {
  if (scope.tipo === 'todos') return true;
  if (scope.tipo === 'ninguno') return false;
  return area === scope.area;
}
