/**
 * Middleware de Next.js
 *
 * - Protege /admin/* con rol admin.
 * - Protege el resto del sitio con sesion valida.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function getRoleFromSession(value: string | undefined) {
  if (!value) return null;
  const parts = value.split('|');
  return parts.length > 1 ? parts[1] : null;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/login') ||
    pathname.startsWith('/api/on-demand') ||
    pathname.startsWith('/api/sports') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  ) {
    return NextResponse.next();
  }

  const session = request.cookies.get('site_session');
  const role = getRoleFromSession(session?.value);

  if (!session) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    if (role !== 'admin') {
      if (pathname.startsWith('/api')) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      }
      return NextResponse.redirect(new URL('/retencion/inicio', request.url));
    }
  }

  if (pathname === '/login') {
    return NextResponse.redirect(new URL('/retencion/inicio', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/:path*'],
};
