/**
 * Proxy de Next (ex middleware; corre en Node, así que puede leer la base).
 *
 * Punto único de control de acceso, antes de cada página y API:
 * - Sesión: la cookie es un token opaco; se valida contra `Sesion` y el `Usuario` activo
 *   (`usuarioDeToken`). Rol y módulos salen de la base, nunca de la cookie.
 * - Rol `empleado`: solo su portal personal (lista blanca `rutaPermitidaEmpleado`); cualquier
 *   otra página lo manda a /admin y cualquier otra API responde 403.
 * - `/admin/*` y `/api/admin/*`: rol admin/superadmin y, además, el módulo que habilita esa
 *   ruta (`permisos-rutas.ts`). Las escrituras de `/api/bonificaciones` también.
 * - Escrituras (POST/PUT/PATCH/DELETE) disparadas desde otro sitio → 403 (CSRF, `Sec-Fetch-Site`).
 * Cada ruta vuelve a chequear rol/sesión por su cuenta (defensa en profundidad).
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isAdminRole, isEmpleadoRole, rutaPermitidaEmpleado } from '@/lib/roles';
import { COOKIE_SESION, usuarioDeToken } from '@/lib/sesion';
import { puedeUsarApi, puedeVerPagina } from '@/lib/permisos-rutas';

const LECTURA = new Set(['GET', 'HEAD', 'OPTIONS']);

function esPublica(pathname: string, metodo: string): boolean {
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/login') ||
    pathname.startsWith('/api/on-demand') ||
    pathname.startsWith('/api/sports') ||
    pathname.startsWith('/api/leads') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname === '/icon.png' ||
    pathname === '/logo.png' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  ) {
    return true;
  }
  // /api/plans: la lectura es pública (la consume la web de las empresas); el PUT es del panel.
  return pathname.startsWith('/api/plans') && LECTURA.has(metodo);
}

/**
 * Escritura disparada desde otra página (CSRF). Se usa `Sec-Fetch-Site`, que el navegador pone
 * solo y no depende del Host que vea el servidor detrás de un proxy inverso. `same-site` también
 * se rechaza: otra app en la misma IP con otro puerto cuenta como "mismo sitio" para las cookies.
 * Sin el header (clientes que no son navegador, navegadores viejos) se deja pasar.
 */
function origenAjeno(request: NextRequest): boolean {
  if (LECTURA.has(request.method)) return false;
  const sitio = request.headers.get('sec-fetch-site');
  return sitio === 'cross-site' || sitio === 'same-site';
}

function prohibido(status: 401 | 403) {
  return NextResponse.json({ error: 'No autorizado' }, { status });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const esApi = pathname.startsWith('/api');

  if (esPublica(pathname, request.method)) {
    // Con sesión abierta, /login lleva al inicio.
    if (pathname === '/login' && request.cookies.has(COOKIE_SESION)) {
      const u = await usuarioDeToken(request.cookies.get(COOKIE_SESION)?.value);
      if (u) return NextResponse.redirect(new URL(isAdminRole(u.rol) || isEmpleadoRole(u.rol) ? '/admin' : '/retencion/inicio', request.url));
    }
    return NextResponse.next();
  }

  // Rutas con sesión: nada de escrituras disparadas desde otro sitio.
  if (origenAjeno(request)) return prohibido(403);

  const usuario = await usuarioDeToken(request.cookies.get(COOKIE_SESION)?.value);
  if (!usuario) {
    const login = new URL('/login', request.url);
    login.searchParams.set('from', pathname);
    const res = esApi ? prohibido(401) : NextResponse.redirect(login);
    if (request.cookies.has(COOKIE_SESION)) res.cookies.delete(COOKIE_SESION);
    return res;
  }

  if (isEmpleadoRole(usuario.rol)) {
    if (rutaPermitidaEmpleado(pathname)) return NextResponse.next();
    return esApi ? prohibido(403) : NextResponse.redirect(new URL('/admin', request.url));
  }

  if (pathname.startsWith('/api/admin')) {
    return puedeUsarApi(pathname, request.method, usuario.rol, usuario.modulos) ? NextResponse.next() : prohibido(403);
  }
  if (pathname.startsWith('/admin')) {
    if (!isAdminRole(usuario.rol)) return NextResponse.redirect(new URL('/retencion/inicio', request.url));
    if (!puedeVerPagina(pathname, usuario.rol, usuario.modulos)) return NextResponse.redirect(new URL('/admin', request.url));
    return NextResponse.next();
  }
  // Escrituras de bonificaciones / planes: solo admin con el módulo.
  if ((pathname.startsWith('/api/bonificaciones') || pathname.startsWith('/api/plans')) && !LECTURA.has(request.method)) {
    return puedeUsarApi(pathname, request.method, usuario.rol, usuario.modulos) ? NextResponse.next() : prohibido(403);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/:path*'],
};
