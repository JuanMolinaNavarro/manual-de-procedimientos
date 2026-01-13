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
  const createBonificacionesTable = `
    CREATE TABLE IF NOT EXISTS bonificaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL CHECK(tipo IN ('A', 'B')),
      titulo TEXT NOT NULL,
      descripcion TEXT,
      condiciones TEXT,
      activa INTEGER DEFAULT 1,
      vigencia_desde TEXT,
      vigencia_hasta TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `;

  db!.exec(createBonificacionesTable);

  db!.exec(`
    CREATE INDEX IF NOT EXISTS idx_bonificaciones_tipo ON bonificaciones(tipo);
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
