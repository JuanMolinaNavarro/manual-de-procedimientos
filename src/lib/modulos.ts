export const ADMIN_MODULOS = [
  { slug: 'bonificaciones', label: 'Bonificaciones', href: '/admin/bonificaciones' },
  { slug: 'usuarios',       label: 'Usuarios',       href: '/admin/usuarios' },
  { slug: 'peliculas',      label: 'Películas',      href: '/admin/peliculas' },
  { slug: 'catalogo',       label: 'Catálogo',       href: '/admin/peliculas/catalogo' },
  { slug: 'deportes',       label: 'Deportes',       href: '/admin/deportes' },
  { slug: 'leads',          label: 'Ventas',         href: '/admin/leads' },
  { slug: 'planes',         label: 'Planes',         href: '/admin/planes' },
  { slug: 'senales-ip',    label: 'Señales IP',     href: '/admin/senales-ip' },
  { slug: 'facturas',      label: 'Facturas',        href: '/admin/facturas' },
] as const;

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
