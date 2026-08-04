/**
 * Roles del sistema. Puro (sin imports) para poder usarse desde el middleware.
 *
 * - `agente`: solo el manual de retención.
 * - `admin`: panel admin, restringido por `modulos` / `modulos_edit`.
 * - `superadmin`: acceso total — todos los módulos, edición de organigrama
 *   implícita y visibilidad de todos los proyectos.
 */
export const ROLES = ['agente', 'admin', 'superadmin'] as const;
export type Rol = (typeof ROLES)[number];

export function isAdminRole(rol: string | null | undefined): boolean {
  return rol === 'admin' || rol === 'superadmin';
}

export function isSuperadmin(rol: string | null | undefined): boolean {
  return rol === 'superadmin';
}
