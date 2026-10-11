import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import {
  activateTotpAndRevokeAccess,
  createSessionWithRecoveryCode,
  disableTotpAndRevokeAccess,
  replacePasswordAndRevokeAccess,
  setPendingTotpSecretForSession,
} from './credentialSecurity.js';

const tempDirectories = [];

async function createDatabase() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cta-recovery-'));
  tempDirectories.push(directory);
  const filename = path.join(directory, 'test.sqlite');
  const setup = await open({ filename, driver: sqlite3.Database });
  await setup.exec(`
    PRAGMA synchronous = OFF;
    PRAGMA journal_mode = WAL;
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      password_hash TEXT,
      credential_version INTEGER NOT NULL DEFAULT 0,
      totp_secret TEXT,
      totp_pending_secret TEXT,
      totp_enabled INTEGER NOT NULL DEFAULT 0,
      recovery_codes_json TEXT
    );
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      credential_version INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    INSERT INTO users (id, credential_version, recovery_codes_json)
    VALUES ('user-target', 4, '["AAAA-BBBB"]');
  `);
  await setup.close();
  return filename;
}

async function connect(filename) {
  const db = await open({ filename, driver: sqlite3.Database });
  await db.exec('PRAGMA busy_timeout = 5000;');
  await db.exec('PRAGMA synchronous = OFF;');
  return db;
}

function consume(db, sessionId) {
  return createSessionWithRecoveryCode({
    db,
    sessionId,
    userId: 'user-target',
    credentialVersion: 4,
    expiresAt: '2026-11-09T12:00:00.000Z',
    createdAt: '2026-10-10T12:00:00.000Z',
    previousRecoveryCodesJson: '["AAAA-BBBB"]',
    remainingRecoveryCodesJson: '[]',
  });
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('atomic recovery-code session creation with SQLite', () => {
  it('allows only one concurrent use and persists exactly one matching session', async () => {
    const filename = await createDatabase();
    const first = await connect(filename);
    const second = await connect(filename);

    const results = await Promise.all([
      consume(first, 'session-first'),
      consume(second, 'session-second'),
    ]);

    await first.close();
    await second.close();

    const verify = await connect(filename);
    const user = await verify.get('SELECT recovery_codes_json FROM users WHERE id = ?', ['user-target']);
    const sessions = await verify.all('SELECT id FROM sessions ORDER BY id');
    await verify.close();

    expect(results.sort()).toEqual([false, true]);
    expect(user.recovery_codes_json).toBe('[]');
    expect(sessions).toHaveLength(1);
    expect(['session-first', 'session-second']).toContain(sessions[0].id);
  });

  it('rolls back the inserted session when consuming the code fails', async () => {
    const filename = await createDatabase();
    const setup = await connect(filename);
    await setup.exec(`
      CREATE TRIGGER reject_recovery_code_update
      BEFORE UPDATE OF recovery_codes_json ON users
      BEGIN
        SELECT RAISE(ABORT, 'simulated recovery update failure');
      END;
    `);
    await setup.close();

    const db = await connect(filename);
    await expect(consume(db, 'session-rolled-back')).rejects.toThrow(
      'simulated recovery update failure'
    );
    await db.close();

    const verify = await connect(filename);
    const user = await verify.get('SELECT recovery_codes_json FROM users WHERE id = ?', ['user-target']);
    const sessionCount = await verify.get('SELECT COUNT(*) AS count FROM sessions');
    await verify.close();

    expect(user.recovery_codes_json).toBe('["AAAA-BBBB"]');
    expect(sessionCount.count).toBe(0);
  });
});

describe('TOTP changes revoke every session with SQLite', () => {
  it('increments the version and removes all sessions when TOTP is activated', async () => {
    const filename = await createDatabase();
    const db = await connect(filename);
    await db.run(
      'UPDATE users SET totp_pending_secret = ? WHERE id = ?',
      ['PENDING-SECRET', 'user-target']
    );
    await db.run(
      `INSERT INTO sessions (id, user_id, credential_version, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)`,
      [
        'session-1', 'user-target', 4, '2026-11-09T12:00:00.000Z', '2026-10-10T12:00:00.000Z',
        'session-2', 'user-target', 4, '2026-11-09T12:00:00.000Z', '2026-10-10T12:00:00.000Z',
      ]
    );
    await db.exec(`
      CREATE TRIGGER create_new_version_session
      AFTER UPDATE OF credential_version ON users
      WHEN NEW.id = 'user-target'
      BEGIN
        INSERT INTO sessions (id, user_id, credential_version, expires_at, created_at)
        VALUES ('session-new', NEW.id, NEW.credential_version,
                '2026-11-09T12:00:00.000Z', '2026-10-11T09:00:00.000Z');
      END;
    `);

    const changed = await activateTotpAndRevokeAccess({
      db,
      userId: 'user-target',
      verifiedSecret: 'PENDING-SECRET',
      recoveryCodesJson: '["NEW-CODE"]',
      sessionId: 'session-1',
      nowIso: '2026-10-11T09:00:00.000Z',
      pendingTotpLogins: new Map(),
    });

    const user = await db.get(
      `SELECT credential_version, totp_secret, totp_pending_secret,
              totp_enabled, recovery_codes_json
       FROM users WHERE id = ?`,
      ['user-target']
    );
    const sessions = await db.all(
      'SELECT id, credential_version FROM sessions ORDER BY id'
    );
    await db.close();

    expect(changed).toBe(true);
    expect(user).toEqual({
      credential_version: 5,
      totp_secret: 'PENDING-SECRET',
      totp_pending_secret: null,
      totp_enabled: 1,
      recovery_codes_json: '["NEW-CODE"]',
    });
    expect(sessions).toEqual([{ id: 'session-new', credential_version: 5 }]);
  });

  it('increments the version and removes all sessions when TOTP is disabled', async () => {
    const filename = await createDatabase();
    const db = await connect(filename);
    await db.run(
      `UPDATE users
       SET totp_secret = ?, totp_enabled = 1, recovery_codes_json = ?
       WHERE id = ?`,
      ['ACTIVE-SECRET', '["ACTIVE-CODE"]', 'user-target']
    );
    await db.run(
      `INSERT INTO sessions (id, user_id, credential_version, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      ['session-1', 'user-target', 4, '2026-11-09T12:00:00.000Z', '2026-10-10T12:00:00.000Z']
    );

    const changed = await disableTotpAndRevokeAccess({
      db,
      userId: 'user-target',
      sessionId: 'session-1',
      nowIso: '2026-10-11T09:00:00.000Z',
      pendingTotpLogins: new Map(),
    });

    const user = await db.get(
      `SELECT credential_version, totp_secret, totp_pending_secret,
              totp_enabled, recovery_codes_json
       FROM users WHERE id = ?`,
      ['user-target']
    );
    const sessionCount = await db.get('SELECT COUNT(*) AS count FROM sessions');
    await db.close();

    expect(changed).toBe(true);
    expect(user).toEqual({
      credential_version: 5,
      totp_secret: null,
      totp_pending_secret: null,
      totp_enabled: 0,
      recovery_codes_json: null,
    });
    expect(sessionCount.count).toBe(0);
  });
});

describe('TOTP setup cannot survive credential revocation', () => {
  it('clears a pending secret when password reset wins after setup', async () => {
    const filename = await createDatabase();
    const db = await connect(filename);
    await db.run(
      `INSERT INTO sessions (id, user_id, credential_version, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      ['session-current', 'user-target', 4, '2026-11-09T12:00:00.000Z', '2026-10-10T12:00:00.000Z']
    );

    const setupChanged = await setPendingTotpSecretForSession({
      db,
      userId: 'user-target',
      sessionId: 'session-current',
      pendingSecret: 'PENDING-SECRET',
      nowIso: '2026-10-11T09:00:00.000Z',
    });
    const resetChanged = await replacePasswordAndRevokeAccess({
      db,
      userId: 'user-target',
      passwordHash: 'new-hash',
      pendingTotpLogins: new Map(),
    });

    const user = await db.get(
      'SELECT credential_version, totp_pending_secret FROM users WHERE id = ?',
      ['user-target']
    );
    await db.close();

    expect(setupChanged).toBe(true);
    expect(resetChanged).toBe(true);
    expect(user).toEqual({ credential_version: 5, totp_pending_secret: null });
  });

  it('rejects stale setup when password reset wins before its write', async () => {
    const filename = await createDatabase();
    const db = await connect(filename);
    await db.run(
      `INSERT INTO sessions (id, user_id, credential_version, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      ['session-stale', 'user-target', 4, '2026-11-09T12:00:00.000Z', '2026-10-10T12:00:00.000Z']
    );

    const resetChanged = await replacePasswordAndRevokeAccess({
      db,
      userId: 'user-target',
      passwordHash: 'new-hash',
      pendingTotpLogins: new Map(),
    });
    const setupChanged = await setPendingTotpSecretForSession({
      db,
      userId: 'user-target',
      sessionId: 'session-stale',
      pendingSecret: 'STALE-SECRET',
      nowIso: '2026-10-11T09:00:00.000Z',
    });

    const user = await db.get(
      'SELECT credential_version, totp_pending_secret FROM users WHERE id = ?',
      ['user-target']
    );
    await db.close();

    expect(resetChanged).toBe(true);
    expect(setupChanged).toBe(false);
    expect(user).toEqual({ credential_version: 5, totp_pending_secret: null });
  });
});

describe('TOTP final mutation requires a still-valid session', () => {
  it('rejects disable from a session invalidated by a concurrent password reset', async () => {
    const filename = await createDatabase();
    const resetConnection = await connect(filename);
    const staleConnection = await connect(filename);
    await resetConnection.run(
      `UPDATE users SET totp_secret = ?, totp_enabled = 1 WHERE id = ?`,
      ['ACTIVE-SECRET', 'user-target']
    );
    await resetConnection.run(
      `INSERT INTO sessions (id, user_id, credential_version, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      ['session-stale', 'user-target', 4, '2026-11-09T12:00:00.000Z', '2026-10-10T12:00:00.000Z']
    );

    const resetChanged = await replacePasswordAndRevokeAccess({
      db: resetConnection,
      userId: 'user-target',
      passwordHash: 'new-hash',
      pendingTotpLogins: new Map(),
    });
    const staleDisableChanged = await disableTotpAndRevokeAccess({
      db: staleConnection,
      userId: 'user-target',
      sessionId: 'session-stale',
      nowIso: '2026-10-11T09:00:00.000Z',
      pendingTotpLogins: new Map(),
    });

    const user = await resetConnection.get(
      'SELECT credential_version, totp_enabled, totp_secret FROM users WHERE id = ?',
      ['user-target']
    );
    await resetConnection.close();
    await staleConnection.close();

    expect(resetChanged).toBe(true);
    expect(staleDisableChanged).toBe(false);
    expect(user).toEqual({
      credential_version: 5,
      totp_enabled: 1,
      totp_secret: 'ACTIVE-SECRET',
    });
  });

  it('rejects activation when the authorizing session expired before the final update', async () => {
    const filename = await createDatabase();
    const db = await connect(filename);
    await db.run('UPDATE users SET totp_pending_secret = ? WHERE id = ?', [
      'PENDING-SECRET',
      'user-target',
    ]);
    await db.run(
      `INSERT INTO sessions (id, user_id, credential_version, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      ['session-expired', 'user-target', 4, '2026-10-11T08:59:59.000Z', '2026-10-10T12:00:00.000Z']
    );

    const changed = await activateTotpAndRevokeAccess({
      db,
      userId: 'user-target',
      verifiedSecret: 'PENDING-SECRET',
      recoveryCodesJson: '["NEW-CODE"]',
      sessionId: 'session-expired',
      nowIso: '2026-10-11T09:00:00.000Z',
      pendingTotpLogins: new Map(),
    });

    const user = await db.get(
      'SELECT credential_version, totp_enabled, totp_pending_secret FROM users WHERE id = ?',
      ['user-target']
    );
    await db.close();

    expect(changed).toBe(false);
    expect(user).toEqual({
      credential_version: 4,
      totp_enabled: 0,
      totp_pending_secret: 'PENDING-SECRET',
    });
  });
});
