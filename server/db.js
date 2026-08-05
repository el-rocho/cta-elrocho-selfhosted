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

export async function initSchema(db) {
  // Tabla de Usuarios
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user', -- 'admin' | 'user'
      sex TEXT,
      birth_date TEXT,
      pin_code TEXT,
      totp_secret TEXT,
      totp_pending_secret TEXT,
      totp_enabled INTEGER NOT NULL DEFAULT 0,
      recovery_codes_json TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Migraciones seguras para columnas añadidas
  try {
    await db.exec('ALTER TABLE users ADD COLUMN sex TEXT;');
  } catch (e) {
    // La columna ya existe
  }
  try {
    await db.exec('ALTER TABLE users ADD COLUMN birth_date TEXT;');
  } catch (e) {
    // La columna ya existe
  }
  try {
    await db.exec('ALTER TABLE users ADD COLUMN totp_pending_secret TEXT;');
  } catch (e) {
    // La columna ya existe
  }

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
      pulse_pressure_confirmed INTEGER NOT NULL DEFAULT 0,
      takes_antihypertensive_medication INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  try {
    await db.exec('ALTER TABLE readings ADD COLUMN pulse_pressure_confirmed INTEGER NOT NULL DEFAULT 0;');
  } catch (e) {
    // La columna ya existe
  }
  try {
    await db.exec('ALTER TABLE readings ADD COLUMN takes_antihypertensive_medication INTEGER;');
  } catch (e) {
    // La columna ya existe
  }

  // Tabla de Ajustes por Usuario
  await db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      user_id TEXT PRIMARY KEY,
      language TEXT NOT NULL DEFAULT 'es',
      enable_white_coat INTEGER NOT NULL DEFAULT 0,
      white_coat_minutes INTEGER NOT NULL DEFAULT 5,
      default_arm TEXT NOT NULL DEFAULT 'left',
      preferred_input_mode TEXT NOT NULL DEFAULT 'keyboard',
      guideline_profile TEXT NOT NULL DEFAULT 'esc-2024',
      treatment_target_mode TEXT NOT NULL DEFAULT 'guideline',
      custom_target_systolic_min INTEGER NOT NULL DEFAULT 120,
      custom_target_systolic_max INTEGER NOT NULL DEFAULT 129,
      custom_target_diastolic_min INTEGER NOT NULL DEFAULT 70,
      custom_target_diastolic_max INTEGER NOT NULL DEFAULT 79,
      patient_name TEXT,
      patient_sex TEXT,
      patient_age TEXT,
      patient_birth_date TEXT,
      takes_antihypertensive_medication INTEGER NOT NULL DEFAULT 0,
      backup_frequency TEXT DEFAULT 'disabled',
      backup_folder TEXT DEFAULT 'Descargas/Copias_Tension_Arterial',
      last_backup_timestamp TEXT,
      last_full_backup_timestamp TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  try {
    await db.exec('ALTER TABLE settings ADD COLUMN patient_birth_date TEXT;');
  } catch (e) {
    // La columna ya existe
  }
  try {
    await db.exec('ALTER TABLE settings ADD COLUMN takes_antihypertensive_medication INTEGER NOT NULL DEFAULT 0;');
  } catch (e) {
    // La columna ya existe
  }
  const treatmentTargetMigrations = [
    "ALTER TABLE settings ADD COLUMN guideline_profile TEXT NOT NULL DEFAULT 'esc-2024';",
    "ALTER TABLE settings ADD COLUMN treatment_target_mode TEXT NOT NULL DEFAULT 'guideline';",
    'ALTER TABLE settings ADD COLUMN custom_target_systolic_min INTEGER NOT NULL DEFAULT 120;',
    'ALTER TABLE settings ADD COLUMN custom_target_systolic_max INTEGER NOT NULL DEFAULT 129;',
    'ALTER TABLE settings ADD COLUMN custom_target_diastolic_min INTEGER NOT NULL DEFAULT 70;',
    'ALTER TABLE settings ADD COLUMN custom_target_diastolic_max INTEGER NOT NULL DEFAULT 79;',
    'ALTER TABLE settings ADD COLUMN last_full_backup_timestamp TEXT;',
  ];
  for (const migration of treatmentTargetMigrations) {
    try {
      await db.exec(migration);
    } catch (e) {
      // La columna ya existe
    }
  }

  // Migración de instalaciones anteriores: las tomas sin contexto heredan una
  // sola vez el perfil actual del usuario. A partir de aquí cada toma lo conserva.
  await db.exec(`
    UPDATE readings
    SET takes_antihypertensive_medication = COALESCE(
      (
        SELECT settings.takes_antihypertensive_medication
        FROM settings
        WHERE settings.user_id = readings.user_id
      ),
      0
    )
    WHERE takes_antihypertensive_medication IS NULL;
  `);

  console.log('✓ Base de datos SQLite y tablas inicializadas correctamente en:', DB_PATH);
}

export { DATA_DIR, DB_PATH, BACKUPS_DIR };
