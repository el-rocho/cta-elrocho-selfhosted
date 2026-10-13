import fs from 'fs';
import os from 'os';
import path from 'path';
import net from 'net';
import { spawn } from 'child_process';
import { afterEach, expect, it } from 'vitest';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { initSchema } from './db.js';

const parents = [];
const servers = [];
afterEach(async () => {
  for (const child of servers.splice(0)) {
    child.kill();
    await new Promise((resolve) => child.once('exit', resolve));
  }
  parents.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

async function availablePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function listFilesRecursively(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(directory, entry.name);
    return entry.isDirectory() ? listFilesRecursively(child) : [child];
  });
}

// El servidor real arranca con una base de datos sembrada; la raíz de datos vive
// dentro de un directorio propio para poder comprobar que ninguna copia se
// escribe fuera de `data/backups/`.
async function startServerWithUser(username) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'cta-backup-http-'));
  parents.push(parent);
  const dataDir = path.join(parent, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const db = await open({ filename: path.join(dataDir, 'cta_database.sqlite'), driver: sqlite3.Database });
  await db.exec('PRAGMA synchronous = OFF;');
  await initSchema(db);
  await db.run(
    'INSERT INTO users (id, username, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
    ['u1', username, 'Javier', 'hash', '2026-01-01']
  );
  await db.run(
    'INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
    ['test-session', 'u1', '2099-01-01T00:00:00.000Z', '2026-01-01']
  );
  await db.run("INSERT INTO settings (user_id) VALUES ('u1')");
  await db.close();

  const port = await availablePort();
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: path.resolve(import.meta.dirname, '..'),
    env: { ...process.env, DATA_DIR: dataDir, HOST: '127.0.0.1', PORT: String(port) },
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

  const generate = (body) => fetch(`${url}/api/backups/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-session-token': 'test-session' },
    body: JSON.stringify(body),
  });
  const backupTimestamp = async () => (await (await fetch(`${url}/api/settings`, {
    headers: { 'x-session-token': 'test-session' },
  })).json()).lastBackupTimestamp;
  return { parent, dataDir, generate, backupTimestamp };
}

it('keeps generated backups inside data/backups and rejects hostile prefixes', async () => {
  const { parent, dataDir, generate, backupTimestamp } = await startServerWithUser('javier');
  const backupsDir = path.join(dataDir, 'backups');
  const csvFiles = () => listFilesRecursively(parent).filter((file) => file.endsWith('.csv'));

  const hostilePrefixes = [
    '../../',
    '../..',
    '/etc/cron.d/evil',
    'evil\\..\\..\\evil',
    'C:\\Windows\\evil',
    'prefijo/',
    '-copia',
    '.',
    'a'.repeat(41),
    ['../../'],
    42,
  ];
  for (const filenamePrefix of hostilePrefixes) {
    const response = await generate({ csvContent: 'a,b\n1,2\n', filenamePrefix });
    expect(response.status, `prefijo ${JSON.stringify(filenamePrefix)}`).toBe(400);
    expect(await response.json()).toEqual({ error: 'El prefijo del nombre de copia no es válido.' });
  }

  const invalidContents = [
    [undefined, 'El contenido de la copia no es válido.'],
    [null, 'El contenido de la copia no es válido.'],
    [{ a: 1 }, 'El contenido de la copia no es válido.'],
    [123, 'El contenido de la copia no es válido.'],
    ['', 'El contenido de la copia está vacío.'],
    ['   ', 'El contenido de la copia está vacío.'],
  ];
  for (const [csvContent, error] of invalidContents) {
    const response = await generate({ csvContent });
    expect(response.status, `contenido ${JSON.stringify(csvContent)}`).toBe(400);
    expect(await response.json()).toEqual({ error });
  }

  // Ninguna petición rechazada deja archivo ni adelanta la fecha del respaldo.
  expect(csvFiles()).toEqual([]);
  expect(await backupTimestamp()).toBeUndefined();

  const accepted = await generate({ csvContent: 'a,b\n1,2\n', filenamePrefix: 'copia' });
  expect(accepted.status).toBe(200);
  const body = await accepted.json();
  expect(body.filename).toMatch(/^copia_javier_\d{4}-\d{2}-\d{2}T[\d-]+Z\.csv$/);
  expect(body.filePath.startsWith(`${backupsDir}${path.sep}`)).toBe(true);
  expect(fs.existsSync(body.filePath)).toBe(true);
  expect(fs.readFileSync(body.filePath, 'utf8')).toBe('a,b\n1,2\n');
  expect(await backupTimestamp()).toBe(body.timestamp);

  expect(csvFiles()).toEqual([path.join(backupsDir, body.filename)]);
}, 30000);

it('normalizes a stored user name that contains path separators', async () => {
  const { parent, dataDir, generate } = await startServerWithUser('usuario/../../evil');
  const backupsDir = path.join(dataDir, 'backups');

  const response = await generate({ csvContent: 'x\n1\n' });
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.filename).toMatch(/^tension_arterial_usuario_evil_\d{4}-\d{2}-\d{2}T[\d-]+Z\.csv$/);
  expect(body.filePath.startsWith(`${backupsDir}${path.sep}`)).toBe(true);

  const written = listFilesRecursively(parent).filter((file) => file.endsWith('.csv'));
  expect(written).toEqual([path.join(backupsDir, body.filename)]);
}, 30000);
