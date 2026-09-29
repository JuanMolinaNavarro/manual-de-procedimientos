/**
 * Sesiones del panel (solo servidor).
 *
 * La cookie `site_session` lleva un token aleatorio de 32 bytes (base64url). En la base
 * (`Sesion`) se guarda solo su sha256: quien lea la base no obtiene sesiones utilizables.
 * Todo lo que decide permisos (rol, activo, módulos) se lee del `Usuario` en cada request;
 * la cookie no afirma nada. Antes la cookie era `usuario|rol` en texto plano y cualquiera
 * podía escribirla a mano para ser superadmin.
 *
 * - Expira a las `SESION_HORAS` (absoluto, sin renovación).
 * - Cerrar sesión revoca la fila; cambiar rol / desactivar / cambiar contraseña revoca
 *   todas las del usuario (`revocarSesionesDeUsuario`).
 * - Usuario inactivo = sin sesión, aunque la fila siga vigente.
 */

import { createHash, randomBytes } from 'crypto';
import { prisma } from './prisma';

export const COOKIE_SESION = 'site_session';
export const SESION_HORAS = 12;

/** Forma del token de la cookie (32 bytes en base64url = 43 caracteres). */
export const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

function idDeToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Crea la sesión y devuelve el token para la cookie (nunca se guarda en claro). */
export async function crearSesion(
  usuarioId: number,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ token: string; expira: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expira = new Date(Date.now() + SESION_HORAS * 3600_000);
  await prisma.sesion.create({
    data: {
      id: idDeToken(token),
      usuario_id: usuarioId,
      expira,
      ip: meta.ip?.slice(0, 64) ?? null,
      user_agent: meta.userAgent?.slice(0, 300) ?? null,
    },
  });
  // Limpieza oportunista de sesiones vencidas hace más de un día.
  prisma.sesion
    .deleteMany({ where: { expira: { lt: new Date(Date.now() - 24 * 3600_000) } } })
    .catch((e) => console.error('Error limpiando sesiones vencidas:', e));
  return { token, expira };
}

export async function revocarSesion(token: string): Promise<void> {
  if (!TOKEN_RE.test(token)) return;
  await prisma.sesion.updateMany({
    where: { id: idDeToken(token), revocada: null },
    data: { revocada: new Date() },
  });
}

export async function revocarSesionesDeUsuario(usuarioId: number): Promise<void> {
  await prisma.sesion.updateMany({
    where: { usuario_id: usuarioId, revocada: null },
    data: { revocada: new Date() },
  });
}

const USUARIO_SESION_SELECT = {
  id: true,
  usuario: true,
  nombre: true,
  apellido: true,
  rol: true,
  isActive: true,
  modulos: true,
  modulos_edit: true,
  empleado_id: true,
  empleado: { select: { id: true, nombre: true, area: true } },
} as const;

/** Usuario dueño de un token vigente (lo usan el proxy y `getSesion`). */
export async function usuarioDeToken(token: string | undefined | null) {
  if (!token || !TOKEN_RE.test(token)) return null;
  const s = await prisma.sesion.findUnique({
    where: { id: idDeToken(token) },
    select: { expira: true, revocada: true, usuario: { select: USUARIO_SESION_SELECT } },
  });
  if (!s || s.revocada || s.expira.getTime() <= Date.now() || !s.usuario.isActive) return null;
  return s.usuario;
}

export type UsuarioSesion = NonNullable<Awaited<ReturnType<typeof usuarioDeToken>>>;
