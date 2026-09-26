export const ADMIN_MODULOS = [
  { slug: 'bonificaciones', label: 'Bonificaciones', href: '/admin/bonificaciones' },
  { slug: 'usuarios',       label: 'Usuarios',       href: '/admin/usuarios' },
  { slug: 'peliculas',      label: 'Películas',      href: '/admin/peliculas' },
  { slug: 'catalogo',       label: 'Catálogo',       href: '/admin/peliculas/catalogo' },
  { slug: 'deportes',       label: 'Deportes',       href: '/admin/deportes' },
  { slug: 'leads',          label: 'Ventas',         href: '/admin/leads' },
  { slug: 'planes',         label: 'Planes',         href: '/admin/planes' },
  { slug: 'senales-ip',    label: 'Señales IP',     href: '/admin/senales-ip' },
  { slug: 'organigrama',   label: 'Organigrama',    href: '/admin/organigrama' },
  { slug: 'asistencia',    label: 'Asistencia',     href: '/admin/asistencia' },
  // Mi asistencia: la vista personal (solo la ficha vinculada al usuario de la sesión).
  { slug: 'mi-asistencia', label: 'Mi asistencia',  href: '/admin/mi-asistencia' },
  // Recibos de sueldo (PDF de Finnegans), en dos módulos separados: la gestión de RR.HH.
  // (importar, avisar, adhesiones, seguimiento de firmas) y la vista personal del empleado
  // (ver y firmar los suyos). Rutas distintas para que un permiso no cubra al otro.
  { slug: 'gestion-recibos', label: 'Gestión de recibos', href: '/admin/gestion-recibos' },
  { slug: 'mis-recibos',   label: 'Mis recibos',    href: '/admin/mis-recibos' },
  { slug: 'padron',        label: 'Padrón',         href: '/admin/padron' },
  { slug: 'proyectos',     label: 'Proyectos',      href: '/admin/proyectos' },
  { slug: 'deposito',      label: 'Depósito',       href: '/admin/deposito' },
  // Nómina (liquidación de sueldos): cada pestaña del módulo es un módulo propio
  // con su permiso, dentro de la categoría RRHH.
  { slug: 'nomina-tablero',     label: 'Nómina · Tablero',     href: '/admin/nomina/tablero' },
  { slug: 'nomina-maestro',     label: 'Nómina · Maestro',     href: '/admin/nomina/maestro' },
  { slug: 'nomina-novedades',   label: 'Nómina · Novedades',   href: '/admin/nomina/novedades' },
  { slug: 'nomina-liquidacion', label: 'Nómina · Liquidación', href: '/admin/nomina/liquidacion' },
  { slug: 'nomina-historico',   label: 'Nómina · Histórico',   href: '/admin/nomina/historico' },
  { slug: 'nomina-parametros',  label: 'Nómina · Parámetros',  href: '/admin/nomina/parametros' },
] as const;

/** Slugs de los sub-módulos de nómina, en el orden de sus pestañas. */
export const NOMINA_SLUGS = [
  'nomina-tablero', 'nomina-maestro', 'nomina-novedades', 'nomina-liquidacion',
  'nomina-historico', 'nomina-parametros',
] as const satisfies readonly AdminModuloSlug[];

/**
 * El módulo Depósito es una app externa: `/admin/deposito` solo verifica el
 * permiso y redirige. El href interno mantiene el módulo dentro del esquema de
 * permisos (sidebar, guard, checkboxes de usuarios) como cualquier otro.
 */
export const DEPOSITO_URL = 'http://192.168.100.108:3100/';

export type AdminModulo = typeof ADMIN_MODULOS[number];
export type AdminModuloSlug = AdminModulo['slug'];

export const ADMIN_MODULO_SLUGS = ADMIN_MODULOS.map((m) => m.slug);

/** Módulos fijos del rol `empleado` (su portal personal). */
export const EMPLEADO_MODULOS = ['mi-asistencia', 'mis-recibos'] as const satisfies readonly AdminModuloSlug[];

/**
 * Módulos que efectivamente puede usar un usuario según su rol:
 * superadmin → todos (`[]`), empleado → siempre `EMPLEADO_MODULOS` (lo guardado en
 * `Usuario.modulos` no cuenta: `[]` significaría "todos"), resto → lo guardado, siempre sin
 * `usuarios` (la gestión de usuarios es solo del superadmin).
 */
export function modulosEfectivos(rol: string | null | undefined, modulos: readonly string[] | null | undefined): string[] {
  if (rol === 'superadmin') return [];
  if (rol === 'empleado') return [...EMPLEADO_MODULOS];
  // Gestión de usuarios: solo superadmin (roles.ts › puedeGestionarUsuarios). `[]` significa
  // "todos", así que se explicita la lista sin `usuarios`.
  const base = modulos && modulos.length ? modulos.map((m) => SLUGS_RENOMBRADOS[m] ?? m) : ADMIN_MODULO_SLUGS;
  const efectivos = base.filter((m) => m !== 'usuarios');
  // Un admin que solo tenía `usuarios` se queda sin nada, no con `[]` (que sería "todos").
  return efectivos.length ? efectivos : [SIN_MODULOS];
}

/** Marca de "ningún módulo": no coincide con ningún slug, así que no habilita nada. */
const SIN_MODULOS = '__ninguno__';

/** Slugs viejos que pueden seguir guardados en `Usuario.modulos` → su módulo actual. */
const SLUGS_RENOMBRADOS: Record<string, AdminModuloSlug> = {
  // "Nómina · Recibos" pasó a ser el módulo propio "Gestión de recibos".
  'nomina-recibos': 'gestion-recibos',
};

/** Empty array means all modules are allowed (backward compatible). */
export function getModulosForUser(modulos: string[]): readonly AdminModulo[] {
  if (modulos.length === 0) return ADMIN_MODULOS;
  return ADMIN_MODULOS.filter((m) => modulos.includes(m.slug));
}

/** Returns true if the given pathname falls under any known admin module. */
export function isAdminModulePath(pathname: string): boolean {
  return ADMIN_MODULOS.some((m) => pathname === m.href || pathname.startsWith(m.href + '/'));
}

/** Returns true if the user is allowed to access the given pathname. */
export function canAccessPath(pathname: string, modulos: string[]): boolean {
  if (modulos.length === 0) return true;
  return ADMIN_MODULOS.some(
    (m) => modulos.includes(m.slug) && (pathname === m.href || pathname.startsWith(m.href + '/'))
  );
}

/**
 * Returns true if the user may EDIT the given module. `modulosEdit` is the per-user
 * edit whitelist (empty = cannot edit anything → view-only). Unlike `modulos` (the
 * navigation whitelist where empty means "all allowed"), an empty edit list grants
 * nothing: editing is opt-in.
 */
export function canEditModule(slug: AdminModuloSlug, modulosEdit: string[]): boolean {
  return modulosEdit.includes(slug);
}
