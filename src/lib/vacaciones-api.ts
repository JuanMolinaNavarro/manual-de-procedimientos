/**
 * Helpers de las rutas de vacaciones (`/api/admin/vacaciones/**` y `/api/admin/mis-vacaciones`):
 * sesión y actor para la auditoría. Los errores se traducen con `respuestaError` de `api-admin.ts`.
 */

import { NextResponse } from 'next/server';
import { getSesion } from './admin-auth';
import { respuestaError } from './api-admin';
import { ipCliente } from './login-limite';
import { NOMINA_SLUGS, modulosEfectivos } from './modulos';
import { isAdminRole } from './roles';
import type { UsuarioSesion } from './sesion';
import type { Actor } from './vacaciones';

interface SesionVac {
  usuario: UsuarioSesion;
  actor: Actor;
  /** Básico y remuneración de referencia (anticipo del art. 155): solo con acceso a Nómina. */
  verSueldos: boolean;
}

/**
 * `admin = true` exige rol admin (gestión de RR.HH.; el módulo ya lo controló el proxy).
 * `admin = false` acepta cualquier sesión: la ruta personal toma la ficha SOLO de la sesión.
 */
export async function conSesion(
  request: Request, where: string, admin: boolean, fn: (s: SesionVac) => Promise<Response>,
): Promise<Response> {
  try {
    const u = await getSesion();
    if (!u) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    if (admin && !isAdminRole(u.rol)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
    const efectivos = modulosEfectivos(u.rol, u.modulos);
    const verSueldos = isAdminRole(u.rol) && (efectivos.length === 0 || efectivos.some((m) => (NOMINA_SLUGS as readonly string[]).includes(m)));
    const nombre = [u.nombre, u.apellido].filter(Boolean).join(' ').trim() || u.usuario;
    return await fn({ usuario: u, actor: { nombre, usuario: u.usuario, ip: ipCliente(request.headers) }, verSueldos });
  } catch (error) {
    return respuestaError(error, where);
  }
}
