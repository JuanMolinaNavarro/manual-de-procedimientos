import { cache } from 'react';
import { cookies } from 'next/headers';
import { canEditModule as slugEditable, type AdminModuloSlug } from './modulos';
import { isAdminRole, isSuperadmin, puedeGestionarPin, puedeGestionarUsuarios } from './roles';
import { COOKIE_SESION, usuarioDeToken } from './sesion';

/**
 * Usuario de la sesión actual, leído de la base (`Sesion` → `Usuario`), o null si no hay
 * sesión vigente o el usuario está inactivo. Memoizado por request. Rol, módulos y estado
 * salen siempre de acá: la cookie es solo un token opaco (ver `sesion.ts`).
 */
export const getSesion = cache(async () => {
  const store = await cookies();
  return usuarioDeToken(store.get(COOKIE_SESION)?.value);
});

/** ¿Hay una sesión vigente (cualquier rol)? */
export async function haySesion(): Promise<boolean> {
  return (await getSesion()) != null;
}

/** ¿La sesión actual es de un usuario activo con rol admin o superadmin? */
export async function isAdmin(): Promise<boolean> {
  const u = await getSesion();
  return !!u && isAdminRole(u.rol);
}

/** Nombre de usuario de la sesión actual (para created_by/updated_by). */
export async function getSessionUsername(): Promise<string | null> {
  return (await getSesion())?.usuario ?? null;
}

/** Registro del usuario de la sesión, con su ficha del organigrama. */
export async function getUsuarioSesion() {
  return getSesion();
}

/**
 * ¿El usuario de la sesión puede EDITAR el módulo dado? Superadmin siempre puede.
 * Para admin requiere que el slug esté en su lista `modulos_edit`.
 */
export async function canEditModule(slug: AdminModuloSlug): Promise<boolean> {
  const u = await getSesion();
  if (!u || !isAdminRole(u.rol)) return false;
  if (isSuperadmin(u.rol)) return true;
  return slugEditable(slug, u.modulos_edit);
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
  const record = await getSesion();
  if (!record || !isAdminRole(record.rol)) return { tipo: 'ninguno' };
  if (isSuperadmin(record.rol)) return { tipo: 'todos' };
  if (record.empleado?.area) return { tipo: 'area', area: record.empleado.area };
  return { tipo: 'ninguno' };
}

/** Gestión de usuarios: solo superadmin. Ver `puedeGestionarUsuarios` en roles.ts. */
export async function puedeGestionarUsuariosSesion(): Promise<boolean> {
  const u = await getSesion();
  return !!u && puedeGestionarUsuarios(u.rol);
}

/**
 * Definir o cambiar PINs de firma (adhesión / revocación / acta): admin de RR.HH., nunca el
 * superadmin (separación de funciones).
 */
export async function puedeGestionarPinSesion(): Promise<boolean> {
  const u = await getSesion();
  return !!u && puedeGestionarPin(u.rol);
}
