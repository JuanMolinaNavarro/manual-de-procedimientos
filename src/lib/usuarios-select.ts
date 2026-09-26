/**
 * Campos de `Usuario` que puede ver la gestión de usuarios. Nunca incluye `password` (hash)
 * ni el estado de bloqueo del login.
 */
export const SELECT_USUARIO = {
  id: true,
  usuario: true,
  nombre: true,
  apellido: true,
  rol: true,
  isActive: true,
  modulos: true,
  modulos_edit: true,
  empleado_id: true,
  created_at: true,
  updated_at: true,
  empleado: { select: { id: true, nombre: true, area: true } },
} as const;
