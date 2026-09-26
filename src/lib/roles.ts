/**
 * Roles del sistema. Puro (sin imports) para poder usarse desde el middleware.
 *
 * - `agente`: solo el manual de retención.
 * - `admin`: panel admin, restringido por `modulos` / `modulos_edit`.
 * - `superadmin`: acceso total — todos los módulos, edición de organigrama
 *   implícita y visibilidad de todos los proyectos.
 * - `empleado`: portal personal. Solo ve Mi asistencia y sus Recibos, siempre de
 *   la ficha vinculada a su usuario. NO es admin: las APIs de `/api/admin/**` le
 *   responden 403 salvo las personales de `rutaPermitidaEmpleado`.
 */
export const ROLES = ['agente', 'admin', 'superadmin', 'empleado'] as const;
export type Rol = (typeof ROLES)[number];

export function isAdminRole(rol: string | null | undefined): boolean {
  return rol === 'admin' || rol === 'superadmin';
}

export function isSuperadmin(rol: string | null | undefined): boolean {
  return rol === 'superadmin';
}

export function isEmpleadoRole(rol: string | null | undefined): boolean {
  return rol === 'empleado';
}

/** Páginas y APIs a las que puede entrar un `empleado` (prefijos, incluyen subrutas). */
const EMPLEADO_PREFIJOS = [
  '/admin/mi-asistencia',
  '/admin/mis-recibos',
  '/api/admin/mi-asistencia',
  '/api/admin/mis-recibos',
] as const;

/** La foto de una ficha: la ruta verifica que sea la propia. */
const FOTO_FICHA_RE = /^\/api\/admin\/organigrama\/empleados\/\d+\/foto$/;

/** Lista blanca del rol `empleado` (la usa el middleware). */
export function rutaPermitidaEmpleado(pathname: string): boolean {
  if (pathname === '/admin' || pathname === '/api/me') return true;
  if (FOTO_FICHA_RE.test(pathname)) return true;
  return EMPLEADO_PREFIJOS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

/**
 * Separación de funciones (decisión del usuario):
 * - Solo el superadmin gestiona usuarios (alta, roles, contraseñas del portal, módulos).
 * - El superadmin NUNCA define ni cambia PINs de firma (adhesión / cambio de PIN): quien puede
 *   resetear la contraseña del portal de alguien no debe poder, además, ponerle un PIN, porque
 *   juntas esas dos cosas permiten firmar un recibo en su nombre.
 * Siempre evaluar con el rol de la BASE (`getUsuarioSesion`), no con el de la cookie: un cambio
 * de rol no se refleja en la cookie hasta el próximo login.
 */
export function puedeGestionarUsuarios(rol: string | null | undefined): boolean {
  return rol === 'superadmin';
}

export function puedeGestionarPin(rol: string | null | undefined): boolean {
  return rol === 'admin';
}
