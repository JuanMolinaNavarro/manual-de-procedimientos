/**
 * db.ts - Conexión a la base de datos SQLite
 *
 * Maneja la conexión a SQLite y la inicialización de tablas necesarias
 * para el sistema de bonificaciones.
 */

import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'db', 'sqlite.db');
let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    initializeTables();
  }
  return db;
}

function initializeTables(): void {
  const columns = db!.prepare("PRAGMA table_info('bonificaciones')").all() as Array<{
    name: string;
  }>;
  const hasTable = columns.length > 0;
  const hasEmpresa = columns.some((column) => column.name === 'empresa');
  const hasTipo = columns.some((column) => column.name === 'tipo');

  if (!hasTable) {
    db!.exec(`
      CREATE TABLE IF NOT EXISTS bonificaciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        empresa TEXT NOT NULL,
        titulo TEXT NOT NULL,
        descripcion TEXT,
        condiciones TEXT,
        activa INTEGER DEFAULT 1,
        vigencia_desde TEXT,
        vigencia_hasta TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } else if (!hasEmpresa && hasTipo) {
    db!.exec(`
      BEGIN TRANSACTION;
      ALTER TABLE bonificaciones RENAME TO bonificaciones_old;
      CREATE TABLE bonificaciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        empresa TEXT NOT NULL,
        titulo TEXT NOT NULL,
        descripcion TEXT,
        condiciones TEXT,
        activa INTEGER DEFAULT 1,
        vigencia_desde TEXT,
        vigencia_hasta TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO bonificaciones (id, empresa, titulo, descripcion, condiciones, activa, vigencia_desde, vigencia_hasta, created_at, updated_at)
      SELECT id, tipo, titulo, descripcion, condiciones, activa, vigencia_desde, vigencia_hasta, created_at, updated_at
      FROM bonificaciones_old;
      DROP TABLE bonificaciones_old;
      COMMIT;
    `);
  }

  db!.exec(`
    CREATE INDEX IF NOT EXISTS idx_bonificaciones_empresa ON bonificaciones(empresa);
    CREATE INDEX IF NOT EXISTS idx_bonificaciones_activa ON bonificaciones(activa);
  `);
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export default getDb;
