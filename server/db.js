import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
const DB_PATH = path.join(DATA_DIR, 'cta_database.sqlite');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
} catch (err) {
  console.error('❌ Error de permisos al crear carpetas de datos:', err.message);
  console.error(`Asegúrate de que la carpeta '${DATA_DIR}' tenga permisos de escritura para el usuario de Node.`);
}

let dbInstance = null;

export async function getDB() {
  if (dbInstance) return dbInstance;

  try {
    dbInstance = await open({
      filename: DB_PATH,
      driver: sqlite3.Database,
    });

    // Activar soporte de claves foráneas y WAL mode para alto rendimiento
    await dbInstance.exec('PRAGMA foreign_keys = ON;');
    await dbInstance.exec('PRAGMA journal_mode = WAL;');

    await initSchema(dbInstance);

    return dbInstance;
  } catch (error) {
    console.error('❌ Error crítico al abrir/inicializar la base de datos SQLite en:', DB_PATH);
    console.error(error);
    throw error;
  }
}

async function initSchema(db) {
  // Tabla de Usuarios
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user', -- 'admin' | 'user'
      pin_code TEXT,
      totp_secret TEXT,
      totp_enabled INTEGER NOT NULL DEFAULT 0,
      recovery_codes_json TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Tabla de Sesiones de Inicio de Sesión
  await db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Tabla de Lecturas de Tensión (asociadas a cada usuario)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS readings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      systolic INTEGER NOT NULL,
      diastolic INTEGER NOT NULL,
      heart_rate INTEGER NOT NULL,
      arm TEXT NOT NULL DEFAULT 'left',
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Tabla de Ajustes por Usuario
  await db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      user_id TEXT PRIMARY KEY,
      language TEXT NOT NULL DEFAULT 'es',
      enable_white_coat INTEGER NOT NULL DEFAULT 0,
      white_coat_minutes INTEGER NOT NULL DEFAULT 5,
      default_arm TEXT NOT NULL DEFAULT 'left',
      preferred_input_mode TEXT NOT NULL DEFAULT 'keyboard',
      patient_name TEXT,
      patient_sex TEXT,
      patient_age TEXT,
      backup_frequency TEXT DEFAULT 'disabled',
      backup_folder TEXT DEFAULT 'Descargas/Copias_Tension_Arterial',
      last_backup_timestamp TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  console.log('✓ Base de datos SQLite y tablas inicializadas correctamente en:', DB_PATH);
}

export { DATA_DIR, BACKUPS_DIR };
