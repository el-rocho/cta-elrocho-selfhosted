import fs from 'fs';
import path from 'path';
import os from 'os';
import { afterEach, expect, it, vi } from 'vitest';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { initSchema } from './db.js';
import { replaceBackupForUser, previewMergeForUser, mergeBackupForUser } from './restoreBackup.js';

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


it('previews exact duplicates and same-instant conflicts including all clinical fields, without writing', async () => {
  const db = await fixture();
  try {
    const timestamp = '2026-01-01T00:00:00.000Z';
    const readings = [
      { id: 'same', timestamp, systolic: 120, diastolic: 80, heartRate: 70, arm: 'left', notes: null, pulsePressureWarningConfirmed: false, takesAntihypertensiveMedication: false },
      { id: 'conflict', timestamp: '2025-12-31T19:00:00-05:00', systolic: 120, diastolic: 80, heartRate: 70, arm: 'right' },
      { id: 'new', timestamp: '2026-01-01T00:00:00.001Z', systolic: 125, diastolic: 78, heartRate: 66, arm: 'right' },
    ];
    const preview = await previewMergeForUser(db, 'u1', { ...snapshot, readings }, 'test-session');
    expect(preview).toMatchObject({ addedCount: 1, duplicateCount: 1, conflictCount: 1, previewToken: expect.any(String) });
    expect(await db.get("SELECT count(*) AS n FROM readings WHERE user_id = 'u1'")).toEqual({ n: 1 });
    const result = await mergeBackupForUser(db, 'u1', { ...snapshot, readings }, preview.previewToken, 'test-session');
    expect(result).toMatchObject({ addedCount: 1, duplicateCount: 1, conflictCount: 1 });
    expect(result.readings).toHaveLength(3);
    expect(await db.get("SELECT count(*) AS n FROM readings WHERE user_id = 'u2'")).toEqual({ n: 1 });
    expect(await db.get("SELECT language FROM settings WHERE user_id = 'u1'")).toEqual({ language: 'es' });
    await expect(mergeBackupForUser(db, 'u1', { ...snapshot, readings }, preview.previewToken, 'test-session')).rejects.toMatchObject({ status: 409 });
  } finally { await db.close(); }
});

it('rejects missing, substituted and stale preview tokens before any merge', async () => {
  const db = await fixture();
  try {
    const preview = await previewMergeForUser(db, 'u1', snapshot, 'test-session');
    for (const [payload, token, session] of [[snapshot, '', 'test-session'], [snapshot, preview.previewToken, 'another-session'], [{ ...snapshot, readings: [{ ...snapshot.readings[0], systolic: 130 }] }, preview.previewToken, 'test-session']]) {
      await expect(mergeBackupForUser(db, 'u1', payload, token, session)).rejects.toMatchObject({ status: 409 });
    }
    await db.run("INSERT INTO readings (id, user_id, timestamp, systolic, diastolic, heart_rate, created_at) VALUES ('raced', 'u1', '2026-09-01T00:00:00.000Z', 140, 90, 70, '2026-01-01')");
    await expect(mergeBackupForUser(db, 'u1', snapshot, preview.previewToken, 'test-session')).rejects.toMatchObject({ status: 409 });
    expect(await db.get("SELECT count(*) AS n FROM readings WHERE user_id = 'u1'")).toEqual({ n: 2 });
  } finally { await db.close(); }
});

it('rolls back merge completely on an insert failure', async () => {
  const db = await fixture();
  try {
    const preview = await previewMergeForUser(db, 'u1', snapshot, 'test-session');
    await db.exec("CREATE TRIGGER fail_merge BEFORE INSERT ON readings BEGIN SELECT RAISE(ABORT, 'failure'); END;");
    await expect(mergeBackupForUser(db, 'u1', snapshot, preview.previewToken, 'test-session')).rejects.toThrow('failure');
    expect(await db.get("SELECT count(*) AS n FROM readings WHERE user_id = 'u1'")).toEqual({ n: 1 });
  } finally { await db.close(); }
});

it('claims a preview token before awaiting SQLite so a concurrent confirmation is always a conflict', async () => {
  let releaseBegin;
  const beginBlocked = new Promise((resolve) => { releaseBegin = resolve; });
  let beginCalls = 0;
  const db = {
    all: vi.fn().mockResolvedValue([]),
    run: vi.fn().mockResolvedValue(undefined),
    exec: vi.fn(async (sql) => {
      if (sql === 'BEGIN IMMEDIATE') {
        beginCalls += 1;
        if (beginCalls === 1) return beginBlocked;
        throw Object.assign(new Error('database is locked'), { code: 'SQLITE_BUSY' });
      }
    }),
  };
  const preview = await previewMergeForUser(db, 'u1', snapshot, 'test-session');

  const accepted = mergeBackupForUser(db, 'u1', snapshot, preview.previewToken, 'test-session');
  await Promise.resolve();
  const concurrent = mergeBackupForUser(db, 'u1', snapshot, preview.previewToken, 'test-session');

  await expect(concurrent).rejects.toMatchObject({ status: 409 });
  expect(beginCalls).toBe(1);
  releaseBegin();
  await expect(accepted).resolves.toMatchObject({ readings: [] });
});
