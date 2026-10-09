import { NextResponse } from 'next/server';
import { idEntero, listarAuditoria } from '@/lib/vacaciones';
import { conSesion } from '@/lib/vacaciones-api';

export const dynamic = 'force-dynamic';

/** Registro del módulo, del más nuevo al más viejo. Query: `empleadoId` (opcional). */
export async function GET(request: Request) {
  return conSesion(request, 'GET /api/admin/vacaciones/auditoria', true, async () => {
    const id = new URL(request.url).searchParams.get('empleadoId');
    return NextResponse.json(await listarAuditoria(id ? idEntero(id) : null));
  });
}
