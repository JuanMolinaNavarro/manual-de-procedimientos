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
  { slug: 'nomina-recibos',     label: 'Nómina · Recibos',     href: '/admin/nomina/recibos' },
  { slug: 'nomina-parametros',  label: 'Nómina · Parámetros',  href: '/admin/nomina/parametros' },
] as const;

/** Slugs de los sub-módulos de nómina, en el orden de sus pestañas. */
export const NOMINA_SLUGS = [
  'nomina-tablero', 'nomina-maestro', 'nomina-novedades', 'nomina-liquidacion',
  'nomina-historico', 'nomina-recibos', 'nomina-parametros',
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
