import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { initSchema } from './db.js';

let testDirectory;

afterEach(() => {
  if (testDirectory) rmSync(testDirectory, { recursive: true, force: true });
  testDirectory = undefined;
});

async function createLegacyDatabase() {
  testDirectory = mkdtempSync(join(tmpdir(), 'cta-server-targets-'));
  const filename = join(testDirectory, 'legacy.sqlite');
  const database = await open({ filename, driver: sqlite3.Database });

  await database.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      sex TEXT,
      birth_date TEXT,
      pin_code TEXT,
      totp_secret TEXT,
      totp_pending_secret TEXT,
      totp_enabled INTEGER NOT NULL DEFAULT 0,
      recovery_codes_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE settings (
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
    INSERT INTO users (id, username, name, password_hash, created_at)
    VALUES ('user-targets', 'targets', 'Targets', 'hash', '2026-07-31T00:00:00.000Z');
    INSERT INTO settings (user_id) VALUES ('user-targets');
  `);

  return { database, filename };
}

const targetCases = [
  ['esc-2024', 'custom', 110, 135, 65, 85],
  ['aha-acc-2025', 'guideline', 0, 129, 0, 79],
  ['ish-2020', 'custom', 120, 139, 70, 89],
];

describe('server treatment-target migration and persistence', () => {
  it.each(targetCases)(
    'migrates and persists every target field for %s',
    async (
      guidelineProfile,
      treatmentTargetMode,
      systolicMin,
      systolicMax,
      diastolicMin,
      diastolicMax
    ) => {
      const { database, filename } = await createLegacyDatabase();
      await initSchema(database);

      const columns = await database.all('PRAGMA table_info(settings)');
      expect(columns.map((column) => column.name)).toEqual(
        expect.arrayContaining([
          'guideline_profile',
          'show_informational_labels',
          'treatment_target_mode',
          'custom_target_systolic_min',
          'custom_target_systolic_max',
          'custom_target_diastolic_min',
          'custom_target_diastolic_max',
          'last_full_backup_timestamp',
        ])
      );

      const migrated = await database.get(
        `SELECT guideline_profile, show_informational_labels, treatment_target_mode,
                custom_target_systolic_min, custom_target_systolic_max,
                custom_target_diastolic_min, custom_target_diastolic_max
         FROM settings WHERE user_id = ?`,
        ['user-targets']
      );
      expect(migrated).toEqual({
        guideline_profile: 'esc-2024',
        show_informational_labels: 1,
        treatment_target_mode: 'guideline',
        custom_target_systolic_min: 120,
        custom_target_systolic_max: 129,
        custom_target_diastolic_min: 70,
        custom_target_diastolic_max: 79,
      });

      await database.run(
        `INSERT INTO users (id, username, name, password_hash, created_at)
         VALUES ('user-new', 'new', 'New', 'hash', '2026-08-29T00:00:00.000Z')`
      );
      await database.run(`INSERT INTO settings (user_id) VALUES ('user-new')`);
      const freshSettings = await database.get(
        `SELECT show_informational_labels FROM settings WHERE user_id = 'user-new'`
      );
      expect(freshSettings.show_informational_labels).toBe(0);

      await database.run(
        `UPDATE settings
         SET guideline_profile = ?, treatment_target_mode = ?,
             custom_target_systolic_min = ?, custom_target_systolic_max = ?,
             custom_target_diastolic_min = ?, custom_target_diastolic_max = ?
         WHERE user_id = ?`,
        [
          guidelineProfile,
          treatmentTargetMode,
          systolicMin,
          systolicMax,
          diastolicMin,
          diastolicMax,
          'user-targets',
        ]
      );
      await database.close();

      const reopened = await open({ filename, driver: sqlite3.Database });
      const persisted = await reopened.get(
        `SELECT guideline_profile, treatment_target_mode,
                custom_target_systolic_min, custom_target_systolic_max,
                custom_target_diastolic_min, custom_target_diastolic_max
         FROM settings WHERE user_id = ?`,
        ['user-targets']
      );
      await reopened.close();

      expect(persisted).toEqual({
        guideline_profile: guidelineProfile,
        treatment_target_mode: treatmentTargetMode,
        custom_target_systolic_min: systolicMin,
        custom_target_systolic_max: systolicMax,
        custom_target_diastolic_min: diastolicMin,
        custom_target_diastolic_max: diastolicMax,
      });
    }
  );
});
