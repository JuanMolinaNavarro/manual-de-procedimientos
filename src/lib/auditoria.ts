/**
 * Registro de quién hizo qué sobre accesos y firmas (tabla `auditoria`, solo se agregan filas).
 * Se escribe en la misma transacción que el cambio: si el registro falla, el cambio no ocurre.
 */

import type { NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { getSessionUsername } from './admin-auth';
import { ipCliente } from './login-limite';

export type AccionAuditoria =
  | 'usuario.alta'
  | 'usuario.cambio' // contraseña, usuario, rol o estado (el detalle dice cuáles)
  | 'adhesion.alta' // incluye el PIN inicial
  | 'adhesion.revocada'
  | 'acta.subida'
  | 'acta.quitada'
  | 'pin.cambio';

/** Quién hace el cambio: usuario de la sesión e IP del pedido. */
export interface Actor {
  usuario: string;
  ip: string;
}

export async function actorDe(request: NextRequest): Promise<Actor> {
  return { usuario: (await getSessionUsername()) ?? '(sin sesión)', ip: ipCliente(request.headers) };
}

export function auditar(
  actor: Actor,
  accion: AccionAuditoria,
  sobre: { usuarioId?: number; empleadoId?: number; detalle?: string },
  db: Pick<Prisma.TransactionClient, 'auditoria'> = prisma,
) {
  return db.auditoria.create({
    data: {
      actor: actor.usuario, accion, ip: actor.ip,
      usuario_id: sobre.usuarioId ?? null, empleado_id: sobre.empleadoId ?? null, detalle: sobre.detalle ?? '',
    },
  });
}
