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

// Arranca el servidor real con una base de datos sembrada y un administrador.
async function startServer(extraEnv = {}) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'cta-auth-http-'));
  parents.push(parent);
  const dataDir = path.join(parent, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const db = await open({ filename: path.join(dataDir, 'cta_database.sqlite'), driver: sqlite3.Database });
  await db.exec('PRAGMA synchronous = OFF;');
  await initSchema(db);
  await db.run(
    "INSERT INTO users (id, username, name, password_hash, role, created_at) VALUES ('u1', 'javier', 'Javier', 'hash', 'admin', '2026-01-01')"
  );
  await db.run(
    "INSERT INTO sessions (id, user_id, credential_version, expires_at, created_at) VALUES ('test-session', 'u1', 0, '2099-01-01T00:00:00.000Z', '2026-01-01')"
  );
  await db.run("INSERT INTO settings (user_id) VALUES ('u1')");
  await db.close();

  const port = await availablePort();
  const env = { ...process.env, DATA_DIR: dataDir, HOST: '127.0.0.1', PORT: String(port), ...extraEnv };
  if (!('CORS_ORIGINS' in extraEnv)) delete env.CORS_ORIGINS;
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: path.resolve(import.meta.dirname, '..'),
    env,
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
  return { url, dataDir };
}

const COOKIE = 'cta_session=test-session';

function request(url, options) {
  return fetch(url, options);
}

it('requires the explicit token across the data API and keeps the session cookie for the sign-in flow', async () => {
  const { url, dataDir } = await startServer();
  const send = (path, { method = 'GET', body, token = true, cookie = true, ...rest } = {}) => request(`${url}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { 'x-session-token': 'test-session' } : {}),
      ...(cookie ? { Cookie: COOKIE } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    ...rest,
  });

  // Flujo de acceso: sigue funcionando con la cookie, porque el token todavía no existe.
  expect((await send('/api/auth/status', { token: false })).status).toBe(200);
  expect((await send('/api/auth/logout', { method: 'POST', token: false, cookie: false })).status).toBe(200);
  const login = await send('/api/auth/login', { method: 'POST', token: false, cookie: false, body: { username: 'nadie', password: 'x' } });
  expect(login.status).not.toBe(403);
  expect((await send('/api/health', { token: false, cookie: false })).status).toBe(200);

  // Lecturas: sin token ni siquiera se llega a los datos.
  for (const [path, method] of [
    ['/api/readings', 'GET'],
    ['/api/settings', 'GET'],
    ['/api/auth/me', 'GET'],
    ['/api/users', 'GET'],
    ['/api/admin/system-status', 'GET'],
    ['/api/readings', 'POST'],
    ['/api/settings', 'POST'],
    ['/api/readings/all/confirm', 'DELETE'],
    ['/api/readings/reset-demo', 'POST'],
    ['/api/sessions/delete', 'POST'],
    ['/api/readings/import', 'POST'],
    ['/api/backups/generate', 'POST'],
    ['/api/backups/restore-replace', 'POST'],
    ['/api/users', 'POST'],
  ]) {
    const response = await send(path, {
      method,
      token: false,
      body: method === 'POST' || method === 'DELETE' ? {} : undefined,
    });
    expect(response.status, `${method} ${path} sin token`).toBe(403);
    expect(await response.json()).toEqual({ error: 'Token explícito requerido' });
  }

  // La lectura sin token no ha dejado rastro y la escritura sin token no ha escrito nada.
  const db = await open({ filename: path.join(dataDir, 'cta_database.sqlite'), driver: sqlite3.Database });
  expect(await db.get('SELECT COUNT(*) AS total FROM readings')).toEqual({ total: 0 });
  await db.close();

  // Con token, la misma API funciona.
  expect((await send('/api/readings')).status).toBe(200);
  const created = await send('/api/readings', {
    method: 'POST',
    body: { timestamp: '2026-10-12T08:00:00.000Z', systolic: 120, diastolic: 80, heartRate: 60, arm: 'left' },
  });
  expect(created.status).toBe(201);
  expect((await send('/api/readings')).status).toBe(200);
  const after = await open({ filename: path.join(dataDir, 'cta_database.sqlite'), driver: sqlite3.Database });
  expect(await after.get('SELECT COUNT(*) AS total FROM readings')).toEqual({ total: 1 });
  await after.close();

  // Token presente pero sesión inexistente: 401, no 403, para que el cliente
  // distinga «vuelve a iniciar sesión» de «falta el token».
  const staleSession = await request(`${url}/api/readings`, {
    headers: { 'x-session-token': 'otra-sesion', Cookie: 'cta_session=otra-sesion' },
  });
  expect(staleSession.status).toBe(401);
}, 30000);

it('sólo refleja como origen permitido los declarados en CORS_ORIGINS', async () => {
  const defaultServer = await startServer();
  const preflight = (origin) => request(`${defaultServer.url}/api/settings`, {
    method: 'OPTIONS',
    headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,x-session-token' },
  });
  const allowed = await preflight('http://127.0.0.1:5175');
  expect(allowed.status).toBeLessThan(300);
  expect(allowed.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:5175');
  expect(allowed.headers.get('access-control-allow-credentials')).toBe('true');
  // La app Android/PWA empaquetada se sirve a sí misma desde localhost, y la PWA
  // del cliente se publica en GitHub Pages.
  for (const appOrigin of ['https://localhost', 'capacitor://localhost', 'https://el-rocho.github.io']) {
    const fromApp = await preflight(appOrigin);
    expect(fromApp.headers.get('access-control-allow-origin'), appOrigin).toBe(appOrigin);
  }
  const foreign = await preflight('https://evil.example');
  expect(foreign.headers.get('access-control-allow-origin')).toBeNull();
  const foreignSimple = await request(`${defaultServer.url}/api/settings`, {
    headers: { Origin: 'https://evil.example', Cookie: COOKIE, 'x-session-token': 'test-session' },
  });
  expect(foreignSimple.status).toBe(200);
  expect(foreignSimple.headers.get('access-control-allow-origin')).toBeNull();

  const customServer = await startServer({ CORS_ORIGINS: 'https://app.example,http://localhost:5174/' });
  const customPreflight = await request(`${customServer.url}/api/settings`, {
    method: 'OPTIONS',
    headers: { Origin: 'https://app.example', 'Access-Control-Request-Method': 'POST' },
  });
  expect(customPreflight.headers.get('access-control-allow-origin')).toBe('https://app.example');
  const trailingSlash = await request(`${customServer.url}/api/settings`, {
    method: 'OPTIONS',
    headers: { Origin: 'http://localhost:5174', 'Access-Control-Request-Method': 'POST' },
  });
  expect(trailingSlash.headers.get('access-control-allow-origin')).toBe('http://localhost:5174');
  const devPortNowForeign = await request(`${customServer.url}/api/settings`, {
    method: 'OPTIONS',
    headers: { Origin: 'http://127.0.0.1:5175', 'Access-Control-Request-Method': 'POST' },
  });
  expect(devPortNowForeign.headers.get('access-control-allow-origin')).toBeNull();
}, 30000);

it('keeps /api/backups/generate from writing copies when the session comes only from the cookie', async () => {
  const { url, dataDir } = await startServer();
  const response = await request(`${url}/api/backups/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: COOKIE },
    body: JSON.stringify({ csvContent: 'a,b\n1,2\n', filenamePrefix: 'copia' }),
  });
  expect(response.status).toBe(403);
  const backups = path.join(dataDir, 'backups');
  expect(fs.existsSync(backups) ? fs.readdirSync(backups) : []).toEqual([]);
}, 30000);
