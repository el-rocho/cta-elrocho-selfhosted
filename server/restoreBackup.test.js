import fs from 'fs';
import path from 'path';
import os from 'os';
import { afterEach, expect, it } from 'vitest';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { initSchema } from './db.js';
import { replaceBackupForUser } from './restoreBackup.js';

const directories = [];
async function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cta-restore-'));
  directories.push(dir);
  const db = await open({ filename: path.join(dir, 'test.sqlite'), driver: sqlite3.Database });
  await db.exec('PRAGMA synchronous = OFF; PRAGMA foreign_keys = ON;');
  await initSchema(db);
  await db.run("INSERT INTO users (id, username, name, password_hash, created_at) VALUES ('u1', 'one', 'Original', 'hash', '2026-01-01')");
  await db.run("INSERT INTO users (id, username, name, password_hash, created_at) VALUES ('u2', 'two', 'Other', 'hash', '2026-01-01')");
  await db.run("INSERT INTO readings (id, user_id, timestamp, systolic, diastolic, heart_rate, created_at) VALUES ('old', 'u1', '2026-01-01T00:00:00.000Z', 120, 80, 70, '2026-01-01')");
  await db.run("INSERT INTO readings (id, user_id, timestamp, systolic, diastolic, heart_rate, created_at) VALUES ('other', 'u2', '2026-01-01T00:00:00.000Z', 130, 85, 75, '2026-01-01')");
  await db.run("INSERT INTO settings (user_id, language, patient_name) VALUES ('u1', 'es', 'Original')");
  return db;
}
const snapshot = {
  format: 'cta-elrocho-backup', version: 1, createdAt: '2026-10-01T00:00:00.000Z',
  readings: [{ id: 'original-id', timestamp: '2026-09-01T12:00:00.000Z', systolic: 125, diastolic: 78, heartRate: 66, arm: 'right', notes: 'restored' }],
  settings: { language: 'en', enableWhiteCoatFilter: true, defaultArm: 'right', preferredInputMode: 'keyboard', guidelineProfile: 'ish-2020', showInformationalLabels: true, treatmentTargetMode: 'guideline', customTargetSystolicMin: 120, customTargetSystolicMax: 129, customTargetDiastolicMin: 70, customTargetDiastolicMax: 79, patientName: 'Restored', patientSex: '', patientAge: '', patientBirthDate: '', takesAntihypertensiveMedication: false, backupFrequency: 'disabled', backupFolder: 'Downloads' },
};
afterEach(() => directories.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

it('replaces only the authenticated user readings and settings atomically', async () => {
  const db = await fixture();
  try {
    const result = await replaceBackupForUser(db, 'u1', snapshot);
    expect(result.readings).toHaveLength(1);
    expect(result.readings[0]).toMatchObject({ systolic: 125, notes: 'restored', arm: 'right' });
    expect(await db.all('SELECT user_id, systolic FROM readings ORDER BY user_id')).toEqual([
      { user_id: 'u1', systolic: 125 }, { user_id: 'u2', systolic: 130 },
    ]);
    expect(await db.get("SELECT language, patient_name FROM settings WHERE user_id = 'u1'"))
      .toEqual({ language: 'en', patient_name: 'Restored' });
    expect(await db.get("SELECT name FROM users WHERE id = 'u1'")).toEqual({ name: 'Restored' });
  } finally { await db.close(); }
});

it('keeps the old readings and settings when an insert fails after deletion', async () => {
  const db = await fixture();
  try {
    await db.exec("CREATE TRIGGER reject_restored_reading BEFORE INSERT ON readings WHEN NEW.user_id = 'u1' BEGIN SELECT RAISE(ABORT, 'simulated insert failure'); END;");
    await expect(replaceBackupForUser(db, 'u1', snapshot)).rejects.toThrow('simulated insert failure');
    expect(await db.get("SELECT id FROM readings WHERE user_id = 'u1'")).toEqual({ id: 'old' });
    expect(await db.get("SELECT language, patient_name FROM settings WHERE user_id = 'u1'"))
      .toEqual({ language: 'es', patient_name: 'Original' });
  } finally { await db.close(); }
});

it('rolls back readings when saving the restored settings fails', async () => {
  const db = await fixture();
  try {
    await db.exec("CREATE TRIGGER reject_restored_settings BEFORE UPDATE ON settings WHEN NEW.user_id = 'u1' BEGIN SELECT RAISE(ABORT, 'simulated settings failure'); END;");
    await expect(replaceBackupForUser(db, 'u1', snapshot)).rejects.toThrow('simulated settings failure');
    expect(await db.get("SELECT id FROM readings WHERE user_id = 'u1'")).toEqual({ id: 'old' });
    expect(await db.get("SELECT language, patient_name FROM settings WHERE user_id = 'u1'"))
      .toEqual({ language: 'es', patient_name: 'Original' });
  } finally { await db.close(); }
});

it('clears a previously set patient name when the backup has an empty name', async () => {
  const db = await fixture();
  try {
    await replaceBackupForUser(db, 'u1', { ...snapshot, settings: { ...snapshot.settings, patientName: '' } });
    expect(await db.get("SELECT name FROM users WHERE id = 'u1'")).toEqual({ name: '' });
    expect(await db.get("SELECT patient_name FROM settings WHERE user_id = 'u1'"))
      .toEqual({ patient_name: '' });
  } finally { await db.close(); }
});

it('rejects invalid backup data without clearing the old history', async () => {
  const db = await fixture();
  try {
    await expect(replaceBackupForUser(db, 'u1', { ...snapshot, readings: [{ ...snapshot.readings[0], systolic: 999 }] }))
      .rejects.toMatchObject({ status: 400 });
    expect(await db.get("SELECT id FROM readings WHERE user_id = 'u1'")).toEqual({ id: 'old' });
  } finally { await db.close(); }
});
