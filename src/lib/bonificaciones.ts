/**
 * bonificaciones.ts - Funciones de acceso a datos para bonificaciones
 *
 * Contiene operaciones CRUD y lógica de filtrado por empresa y vigencia.
 */

import { getDb } from './db';
import { type Empresa } from './empresas';

export interface Bonificacion {
  id: number;
  empresa: Empresa | string;
  titulo: string;
  descripcion: string | null;
  condiciones: string | null;
  activa: boolean;
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBonificacionData {
  empresa: Empresa;
  titulo: string;
  descripcion?: string;
  condiciones?: string;
  vigencia_desde?: string | null;
  vigencia_hasta?: string | null;
}

export interface UpdateBonificacionData {
  empresa?: Empresa;
  titulo?: string;
  descripcion?: string;
  condiciones?: string;
  activa?: boolean;
  vigencia_desde?: string | null;
  vigencia_hasta?: string | null;
}

function mapBonificacion(row: Record<string, unknown>): Bonificacion {
  return {
    ...row,
    activa: row.activa === 1,
  } as Bonificacion;
}

export function getBonificacionesActivas(empresa?: string | null): Bonificacion[] {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const params: Array<string> = [today, today];
  let whereEmpresa = '';

  if (empresa) {
    whereEmpresa = 'AND empresa = ?';
    params.push(empresa);
  }

  const stmt = db.prepare(`
    SELECT * FROM bonificaciones
    WHERE activa = 1
      AND (vigencia_desde IS NULL OR vigencia_desde <= ?)
      AND (vigencia_hasta IS NULL OR vigencia_hasta >= ?)
      ${whereEmpresa}
    ORDER BY id DESC
  `);

  const rows = stmt.all(...params) as Record<string, unknown>[];
  return rows.map(mapBonificacion);
}

export function getAllBonificaciones(): Bonificacion[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM bonificaciones ORDER BY id DESC');
  const rows = stmt.all() as Record<string, unknown>[];
  return rows.map(mapBonificacion);
}

export function getBonificacionById(id: number): Bonificacion | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM bonificaciones WHERE id = ?');
  const row = stmt.get(id) as Record<string, unknown> | undefined;
  return row ? mapBonificacion(row) : null;
}

export function createBonificacion(data: CreateBonificacionData): Bonificacion {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO bonificaciones (empresa, titulo, descripcion, condiciones, vigencia_desde, vigencia_hasta)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    data.empresa,
    data.titulo,
    data.descripcion || null,
    data.condiciones || null,
    data.vigencia_desde || null,
    data.vigencia_hasta || null
  );

  return getBonificacionById(result.lastInsertRowid as number)!;
}

export function updateBonificacion(
  id: number,
  data: UpdateBonificacionData
): Bonificacion | null {
  const db = getDb();
  const existing = getBonificacionById(id);

  if (!existing) {
    return null;
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  if (data.empresa !== undefined) {
    updates.push('empresa = ?');
    values.push(data.empresa);
  }
  if (data.titulo !== undefined) {
    updates.push('titulo = ?');
    values.push(data.titulo);
  }
  if (data.descripcion !== undefined) {
    updates.push('descripcion = ?');
    values.push(data.descripcion);
  }
  if (data.condiciones !== undefined) {
    updates.push('condiciones = ?');
    values.push(data.condiciones);
  }
  if (data.activa !== undefined) {
    updates.push('activa = ?');
    values.push(data.activa ? 1 : 0);
  }
  if (data.vigencia_desde !== undefined) {
    updates.push('vigencia_desde = ?');
    values.push(data.vigencia_desde);
  }
  if (data.vigencia_hasta !== undefined) {
    updates.push('vigencia_hasta = ?');
    values.push(data.vigencia_hasta);
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');

  if (updates.length > 0) {
    const stmt = db.prepare(`
      UPDATE bonificaciones
      SET ${updates.join(', ')}
      WHERE id = ?
    `);
    values.push(id);
    stmt.run(...values);
  }

  return getBonificacionById(id);
}

export function softDeleteBonificacion(id: number): boolean {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE bonificaciones
    SET activa = 0, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  const result = stmt.run(id);
  return result.changes > 0;
}

export function activateBonificacion(id: number): boolean {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE bonificaciones
    SET activa = 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  const result = stmt.run(id);
  return result.changes > 0;
}
