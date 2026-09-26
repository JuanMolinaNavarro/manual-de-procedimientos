/**
 * Qué módulo (`Usuario.modulos`) habilita cada ruta, evaluado en el servidor (proxy).
 * Puro, sin imports de servidor: se testea en `permisos-rutas.test.ts`, que además recorre
 * `src/app/api/admin/**` y exige que toda ruta tenga regla.
 *
 * Antes los módulos solo se aplicaban en el navegador (`AdminModuleGuard`): un admin con
 * "Películas" podía llamar a `/api/admin/nomina/*` y leer sueldos.
 *
 * Reglas de API: gana el prefijo más largo. `modulos` habilita todos los métodos; `lectura`
 * suma módulos que solo pueden hacer GET/HEAD (otra pantalla que muestra ese dato). Sin regla
 * → solo superadmin (denegar por defecto). El candado fino de edición del organigrama
 * (`modulos_edit`) sigue en cada ruta con `canEditModule`.
 */

import { isAdminRole, isSuperadmin } from './roles';
import { NOMINA_SLUGS, canAccessPath, isAdminModulePath, modulosEfectivos, type AdminModuloSlug } from './modulos';

type Regla = {
  prefijo: string;
  /** Módulos que habilitan la ruta, o `'admin'` = cualquier admin (sin módulo). */
  modulos: readonly AdminModuloSlug[] | 'admin';
  /** Módulos que solo habilitan GET/HEAD. */
  lectura?: readonly AdminModuloSlug[];
};

const NOMINA_Y_RECIBOS: readonly AdminModuloSlug[] = [...NOMINA_SLUGS, 'gestion-recibos'];

export const REGLAS_API: readonly Regla[] = [
  { prefijo: '/api/admin/asistencia', modulos: ['asistencia'] },
  // La ficha del organigrama muestra el horario (solo lectura).
  { prefijo: '/api/admin/asistencia/horarios', modulos: ['asistencia'], lectura: ['organigrama'] },
  { prefijo: '/api/admin/deportes', modulos: ['deportes'] },
  { prefijo: '/api/admin/fanart', modulos: ['peliculas'] },
  { prefijo: '/api/admin/omdb', modulos: ['peliculas'] },
  { prefijo: '/api/admin/on-demand', modulos: ['peliculas'] },
  { prefijo: '/api/admin/mwproxy', modulos: ['catalogo'] },
  { prefijo: '/api/admin/pipeline', modulos: ['catalogo'] },
  { prefijo: '/api/admin/leads', modulos: ['leads'] },
  { prefijo: '/api/admin/padron', modulos: ['padron'] },
  { prefijo: '/api/admin/planes', modulos: ['planes'] },
  { prefijo: '/api/admin/proyectos', modulos: ['proyectos'] },
  { prefijo: '/api/admin/senales-ip', modulos: ['senales-ip'] },
  { prefijo: '/api/admin/usuarios', modulos: ['usuarios'] },
  { prefijo: '/api/admin/organigrama', modulos: ['organigrama'] },
  // Nómina: cualquier pestaña de nómina o la gestión de recibos (comparten estado, config y
  // el recibo calculado). Lo que es solo de RR.HH. de recibos va más abajo.
  { prefijo: '/api/admin/nomina', modulos: NOMINA_Y_RECIBOS },
  { prefijo: '/api/admin/nomina/adhesiones', modulos: ['gestion-recibos'] },
  { prefijo: '/api/admin/nomina/acta-datos', modulos: ['gestion-recibos'] },
  { prefijo: '/api/admin/nomina/finnegans', modulos: ['gestion-recibos'] },
  // La pestaña Recibos de la ficha del organigrama abre el PDF.
  { prefijo: '/api/admin/nomina/firma', modulos: ['gestion-recibos'], lectura: ['organigrama'] },
  // Portal personal: cada ruta resuelve la ficha SOLO de la sesión (sin módulo).
  { prefijo: '/api/admin/mi-asistencia', modulos: 'admin' },
  { prefijo: '/api/admin/mis-recibos', modulos: 'admin' },
  // Fuera de /api/admin: solo las escrituras exigen admin (GET lo usan los agentes).
  { prefijo: '/api/bonificaciones', modulos: ['bonificaciones'] },
  { prefijo: '/api/plans', modulos: ['planes'] },
];

/** Foto de una ficha: se muestra en Organigrama, Asistencia, Nómina, Proyectos… (cualquier admin). */
const FOTO_FICHA_RE = /^\/api\/admin\/organigrama\/empleados\/\d+\/foto$/;

function coincide(pathname: string, prefijo: string): boolean {
  return pathname === prefijo || pathname.startsWith(prefijo + '/');
}

export function reglaApi(pathname: string): Regla | null {
  if (FOTO_FICHA_RE.test(pathname)) return { prefijo: pathname, modulos: 'admin', lectura: [] };
  let mejor: Regla | null = null;
  for (const r of REGLAS_API) {
    if (coincide(pathname, r.prefijo) && (!mejor || r.prefijo.length > mejor.prefijo.length)) mejor = r;
  }
  return mejor;
}

const LECTURA = new Set(['GET', 'HEAD']);

/**
 * ¿Un usuario admin puede usar esta API con este método? No mira sesión ni rol empleado
 * (eso lo resuelve el proxy antes).
 */
export function puedeUsarApi(
  pathname: string,
  metodo: string,
  rol: string | null | undefined,
  modulos: readonly string[] | null | undefined,
): boolean {
  if (!isAdminRole(rol)) return false;
  if (isSuperadmin(rol)) return true;
  const regla = reglaApi(pathname);
  if (!regla) return false;
  if (regla.modulos === 'admin') return true;
  const efectivos = modulosEfectivos(rol, modulos);
  if (efectivos.length === 0) return true;
  const permitidos = LECTURA.has(metodo.toUpperCase()) ? [...regla.modulos, ...(regla.lectura ?? [])] : regla.modulos;
  return permitidos.some((m) => efectivos.includes(m));
}

/** ¿Un admin puede abrir esta página de `/admin`? Mismo criterio que el guard del cliente. */
export function puedeVerPagina(pathname: string, rol: string | null | undefined, modulos: readonly string[] | null | undefined): boolean {
  if (!isAdminRole(rol)) return false;
  const efectivos = modulosEfectivos(rol, modulos);
  if (efectivos.length === 0 || !isAdminModulePath(pathname)) return true;
  return canAccessPath(pathname, efectivos);
}

/**
 * `from` del login → ruta interna o null. Solo caminos relativos del propio sitio: nada de
 * `https://otro`, `//otro` ni `/\otro` (el navegador los toma como otro host: open redirect).
 */
export function rutaInternaSegura(from: string | null | undefined): string | null {
  if (!from || !from.startsWith('/') || from.startsWith('//')) return null;
  // Barra invertida (`/\otro`) o caracteres de control: los navegadores los normalizan a `//`.
  if (/[\\\u0000-\u001f]/.test(from)) return null;
  return from;
}
