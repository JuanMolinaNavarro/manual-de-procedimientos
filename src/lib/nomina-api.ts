/**
 * Helpers de las rutas /api/admin/nomina/**: parseo de query/body propio de nómina. Los
 * wrappers y el mapeo de errores son los comunes de `api-admin.ts`.
 */

import { NextResponse } from 'next/server';
import { parseId } from './api-admin';
import { MES_RE } from './fechas';
import { NominaError } from './nomina';

export { handle, handleSesion, parseId, readJson } from './api-admin';

export const parseOrgId = (v: unknown): number => parseId(v, 'organigramaId');

/**
 * Filtros opcionales de Gestión de recibos: `empleador` (CUIT de la empresa que liquida) y
 * `lugar` (organigrama de la ficha). Vacíos o inválidos = sin filtro.
 */
export function parseFiltrosRecibos(p: URLSearchParams): { empleador: string | null; lugar: number | null } {
  const cuit = (p.get('empleador') ?? '').replace(/\D/g, '');
  const lugar = Number(p.get('lugar'));
  return { empleador: cuit.length === 11 ? cuit : null, lugar: Number.isInteger(lugar) && lugar > 0 ? lugar : null };
}

export function parsePeriodo(v: unknown): string {
  if (typeof v !== 'string' || !MES_RE.test(v)) throw new NominaError('Período inválido (formato YYYY-MM)', 400);
  return v;
}

/** Respuesta PDF (inline o descarga) sin cache compartida. */
export function pdfResponse(pdf: Uint8Array, nombre: string, descargar = false): NextResponse {
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${descargar ? 'attachment' : 'inline'}; filename="${nombre.replace(/[^\w.-]/g, '_')}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
