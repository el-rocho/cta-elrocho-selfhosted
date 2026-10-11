import fs from 'fs';
import os from 'os';
import path from 'path';
import net from 'net';
import { spawn } from 'child_process';
import { afterEach, expect, it } from 'vitest';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { initSchema } from './db.js';

const directories = [];
const servers = [];
afterEach(async () => {
  for (const child of servers.splice(0)) {
    child.kill();
    await new Promise((resolve) => child.once('exit', resolve));
  }
  directories.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

async function availablePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

it('exposes authenticated atomic restore over HTTP and preserves state on a database error', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cta-restore-http-'));
  directories.push(directory);
  const db = await open({ filename: path.join(directory, 'cta_database.sqlite'), driver: sqlite3.Database });
  await db.exec('PRAGMA synchronous = OFF;');
  await initSchema(db);
  await db.run("INSERT INTO users (id, username, name, password_hash, created_at) VALUES ('u1', 'one', 'Original', 'hash', '2026-01-01')");
  await db.run("INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES ('test-session', 'u1', '2099-01-01T00:00:00.000Z', '2026-01-01')");
  await db.run("INSERT INTO readings (id, user_id, timestamp, systolic, diastolic, heart_rate, created_at) VALUES ('old', 'u1', '2026-01-01T00:00:00.000Z', 120, 80, 70, '2026-01-01')");
  await db.close();
  const port = await availablePort();
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: path.resolve(import.meta.dirname, '..'),
    env: { ...process.env, DATA_DIR: directory, HOST: '127.0.0.1', PORT: String(port) },
    stdio: 'ignore',
  });
  servers.push(child);
  const url = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let tries = 0; tries < 100; tries++) {
    try { if ((await fetch(`${url}/api/health`)).ok) { ready = true; break; } } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  expect(ready).toBe(true);
  const snapshot = {
    format: 'cta-elrocho-backup', version: 1, createdAt: '2026-10-01T00:00:00.000Z',
    readings: [{ id: 'backup-1', timestamp: '2026-09-01T00:00:00.000Z', systolic: 125, diastolic: 78, heartRate: 66, arm: 'right' }],
    settings: { language: 'en', enableWhiteCoatFilter: true, defaultArm: 'right', preferredInputMode: 'keyboard', guidelineProfile: 'ish-2020', showInformationalLabels: true, treatmentTargetMode: 'guideline', customTargetSystolicMin: 120, customTargetSystolicMax: 129, customTargetDiastolicMin: 70, customTargetDiastolicMax: 79, patientName: 'Restored', takesAntihypertensiveMedication: false, backupFrequency: 'disabled', backupFolder: 'Downloads' },
  };
  const restore = (payload, authenticated = true) => fetch(`${url}/api/backups/restore-replace`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(authenticated ? { 'x-session-token': 'test-session' } : {}) }, body: JSON.stringify(payload),
  });
  expect((await restore(snapshot, false)).status).toBe(403);
  const crossOriginImport = await fetch(`${url}/api/readings/import`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.example', Cookie: 'cta_session=test-session' },
    body: JSON.stringify(snapshot.readings),
  });
  expect(crossOriginImport.status).toBe(403);
  const cookieOnlyImport = await fetch(`${url}/api/readings/import`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'cta_session=test-session' },
    body: JSON.stringify(snapshot.readings),
  });
  expect(cookieOnlyImport.status).toBe(403);
  const validImport = await fetch(`${url}/api/readings/import`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-session-token': 'test-session' },
    body: JSON.stringify([]),
  });
  expect(validImport.status).toBe(200);
  const crossOrigin = await fetch(`${url}/api/backups/restore-replace`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.example', Cookie: 'cta_session=test-session' },
    body: JSON.stringify(snapshot),
  });
  expect(crossOrigin.status).toBe(403);
  expect((await restore({ ...snapshot, readings: [{ ...snapshot.readings[0], systolic: 999 }] })).status).toBe(400);
  let result = await restore(snapshot);
  expect(result.status).toBe(200);
  expect((await result.json()).readings).toMatchObject([{ systolic: 125 }]);
  const check = await open({ filename: path.join(directory, 'cta_database.sqlite'), driver: sqlite3.Database });
  await check.exec("CREATE TRIGGER fail_future_restore BEFORE INSERT ON readings BEGIN SELECT RAISE(ABORT, 'failure'); END;");
  result = await restore({ ...snapshot, readings: [{ ...snapshot.readings[0], systolic: 135 }] });
  expect(result.status).toBe(500);
  expect(await check.get("SELECT systolic FROM readings WHERE user_id = 'u1'")).toEqual({ systolic: 125 });
  expect(await check.get("SELECT language FROM settings WHERE user_id = 'u1'")).toEqual({ language: 'en' });
  await check.close();
}, 15000);
