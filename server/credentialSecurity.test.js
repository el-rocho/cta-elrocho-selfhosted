import { describe, expect, it, vi } from 'vitest';
import {
  activateTotpAndRevokeAccess,
  createSessionWithRecoveryCode,
  disableTotpAndRevokeAccess,
  insertSessionForCredentialVersion,
  replacePasswordAndRevokeAccess,
  setPendingTotpSecretForSession,
} from './credentialSecurity.js';

describe('password reset credential revocation', () => {
  it('increments the credential version before deleting sessions and pending TOTP logins', async () => {
    const db = {
      run: vi.fn()
        .mockResolvedValueOnce({ changes: 1 })
        .mockResolvedValueOnce({ changes: 2 }),
    };
    const pendingTotpLogins = new Map([
      ['target-1', { userId: 'user-target', credentialVersion: 3, expiresAt: 1 }],
      ['other-user', { userId: 'user-other', credentialVersion: 1, expiresAt: 2 }],
      ['target-2', { userId: 'user-target', credentialVersion: 3, expiresAt: 3 }],
    ]);

    const changed = await replacePasswordAndRevokeAccess({
      db,
      userId: 'user-target',
      passwordHash: 'new-password-hash',
      pendingTotpLogins,
    });

    expect(changed).toBe(true);
    expect(db.run).toHaveBeenNthCalledWith(
      1,
      `UPDATE users
     SET password_hash = ?, totp_pending_secret = NULL,
         credential_version = credential_version + 1
     WHERE id = ?`,
      ['new-password-hash', 'user-target']
    );
    expect(db.run).toHaveBeenNthCalledWith(
      2,
      `DELETE FROM sessions
       WHERE user_id = ?
         AND credential_version < (
           SELECT credential_version FROM users WHERE id = ?
         )`,
      ['user-target', 'user-target']
    );
    expect([...pendingTotpLogins.keys()]).toEqual(['other-user']);
  });

  it('keeps the reset successful when stale-session cleanup fails', async () => {
    const cleanupError = new Error('disk I/O error');
    const db = {
      run: vi.fn()
        .mockResolvedValueOnce({ changes: 1 })
        .mockRejectedValueOnce(cleanupError),
    };
    const pendingTotpLogins = new Map([
      ['target-login', { userId: 'user-target', credentialVersion: 3, expiresAt: 1 }],
    ]);
    const onCleanupError = vi.fn();

    const changed = await replacePasswordAndRevokeAccess({
      db,
      userId: 'user-target',
      passwordHash: 'new-password-hash',
      pendingTotpLogins,
      onCleanupError,
    });

    expect(changed).toBe(true);
    expect(pendingTotpLogins.size).toBe(0);
    expect(onCleanupError).toHaveBeenCalledWith(cleanupError);
  });

  it('does not report success or alter challenges when the user does not exist', async () => {
    const db = {
      run: vi.fn().mockResolvedValueOnce({ changes: 0 }),
    };
    const pendingTotpLogins = new Map([
      ['target-login', { userId: 'missing-user', credentialVersion: 0, expiresAt: 1 }],
    ]);

    const changed = await replacePasswordAndRevokeAccess({
      db,
      userId: 'missing-user',
      passwordHash: 'new-password-hash',
      pendingTotpLogins,
    });

    expect(changed).toBe(false);
    expect(db.run).toHaveBeenCalledTimes(1);
    expect(pendingTotpLogins.has('target-login')).toBe(true);
  });
});

describe('TOTP setup session validation', () => {
  it('stores a pending secret only while the session credential version is current', async () => {
    const db = {
      run: vi.fn().mockResolvedValue({ changes: 1 }),
    };

    const changed = await setPendingTotpSecretForSession({
      db,
      userId: 'user-target',
      sessionId: 'session-current',
      pendingSecret: 'PENDING-SECRET',
      nowIso: '2026-10-11T09:00:00.000Z',
    });

    expect(changed).toBe(true);
    expect(db.run).toHaveBeenCalledWith(
      `UPDATE users
     SET totp_pending_secret = ?
     WHERE id = ?
       AND EXISTS (
         SELECT 1 FROM sessions
         WHERE sessions.id = ?
           AND sessions.user_id = users.id
           AND sessions.credential_version = users.credential_version
           AND sessions.expires_at >= ?
       )`,
      ['PENDING-SECRET', 'user-target', 'session-current', '2026-10-11T09:00:00.000Z']
    );
  });

  it('rejects setup from a session invalidated before the pending secret is stored', async () => {
    const db = {
      run: vi.fn().mockResolvedValue({ changes: 0 }),
    };

    const changed = await setPendingTotpSecretForSession({
      db,
      userId: 'user-target',
      sessionId: 'session-stale',
      pendingSecret: 'PENDING-SECRET',
      nowIso: '2026-10-11T09:00:00.000Z',
    });

    expect(changed).toBe(false);
  });
});

describe('TOTP credential revocation', () => {
  it('activates the verified pending secret and globally invalidates sessions', async () => {
    const db = {
      run: vi.fn()
        .mockResolvedValueOnce({ changes: 1 })
        .mockResolvedValueOnce({ changes: 2 }),
    };
    const pendingTotpLogins = new Map([
      ['target-login', { userId: 'user-target', credentialVersion: 4, expiresAt: 1 }],
      ['other-login', { userId: 'user-other', credentialVersion: 2, expiresAt: 2 }],
    ]);

    const changed = await activateTotpAndRevokeAccess({
      db,
      userId: 'user-target',
      verifiedSecret: 'PENDING-SECRET',
      recoveryCodesJson: '["AAAA-BBBB"]',
      sessionId: 'session-current',
      nowIso: '2026-10-11T09:00:00.000Z',
      pendingTotpLogins,
    });

    expect(changed).toBe(true);
    expect(db.run).toHaveBeenNthCalledWith(
      1,
      `UPDATE users
     SET totp_secret = ?, totp_pending_secret = NULL, totp_enabled = 1,
         recovery_codes_json = ?, credential_version = credential_version + 1
     WHERE id = ? AND totp_pending_secret = ?
       AND EXISTS (
         SELECT 1 FROM sessions
         WHERE sessions.id = ?
           AND sessions.user_id = users.id
           AND sessions.credential_version = users.credential_version
           AND sessions.expires_at >= ?
       )`,
      [
        'PENDING-SECRET',
        '["AAAA-BBBB"]',
        'user-target',
        'PENDING-SECRET',
        'session-current',
        '2026-10-11T09:00:00.000Z',
      ]
    );
    expect(db.run).toHaveBeenNthCalledWith(
      2,
      `DELETE FROM sessions
       WHERE user_id = ?
         AND credential_version < (
           SELECT credential_version FROM users WHERE id = ?
         )`,
      ['user-target', 'user-target']
    );
    expect([...pendingTotpLogins.keys()]).toEqual(['other-login']);
  });

  it('disables TOTP and globally invalidates sessions', async () => {
    const db = {
      run: vi.fn()
        .mockResolvedValueOnce({ changes: 1 })
        .mockResolvedValueOnce({ changes: 1 }),
    };
    const pendingTotpLogins = new Map([
      ['target-login', { userId: 'user-target', credentialVersion: 4, expiresAt: 1 }],
    ]);

    const changed = await disableTotpAndRevokeAccess({
      db,
      userId: 'user-target',
      sessionId: 'session-current',
      nowIso: '2026-10-11T09:00:00.000Z',
      pendingTotpLogins,
    });

    expect(changed).toBe(true);
    expect(db.run).toHaveBeenNthCalledWith(
      1,
      `UPDATE users
     SET totp_enabled = 0, totp_secret = NULL, totp_pending_secret = NULL,
         recovery_codes_json = NULL, credential_version = credential_version + 1
     WHERE id = ?
       AND EXISTS (
         SELECT 1 FROM sessions
         WHERE sessions.id = ?
           AND sessions.user_id = users.id
           AND sessions.credential_version = users.credential_version
           AND sessions.expires_at >= ?
       )`,
      ['user-target', 'session-current', '2026-10-11T09:00:00.000Z']
    );
    expect(db.run).toHaveBeenNthCalledWith(
      2,
      `DELETE FROM sessions
       WHERE user_id = ?
         AND credential_version < (
           SELECT credential_version FROM users WHERE id = ?
         )`,
      ['user-target', 'user-target']
    );
    expect(pendingTotpLogins.size).toBe(0);
  });

  it('does not revoke access when the pending TOTP secret changed before activation', async () => {
    const db = {
      run: vi.fn().mockResolvedValueOnce({ changes: 0 }),
    };
    const pendingTotpLogins = new Map([
      ['target-login', { userId: 'user-target', credentialVersion: 4, expiresAt: 1 }],
    ]);

    const changed = await activateTotpAndRevokeAccess({
      db,
      userId: 'user-target',
      verifiedSecret: 'STALE-SECRET',
      recoveryCodesJson: '[]',
      sessionId: 'session-stale',
      nowIso: '2026-10-11T09:00:00.000Z',
      pendingTotpLogins,
    });

    expect(changed).toBe(false);
    expect(db.run).toHaveBeenCalledTimes(1);
    expect(pendingTotpLogins.has('target-login')).toBe(true);
  });
});

describe('versioned session creation', () => {
  it('rejects a session created from credentials invalidated during login', async () => {
    const db = {
      run: vi.fn().mockResolvedValue({ changes: 0 }),
    };

    const inserted = await insertSessionForCredentialVersion({
      db,
      sessionId: 'session-stale',
      userId: 'user-target',
      credentialVersion: 4,
      expiresAt: '2026-11-09T12:00:00.000Z',
      createdAt: '2026-10-10T12:00:00.000Z',
    });

    expect(inserted).toBe(false);
    expect(db.run).toHaveBeenCalledWith(
      `INSERT INTO sessions (id, user_id, credential_version, expires_at, created_at)
     SELECT ?, id, credential_version, ?, ?
     FROM users
     WHERE id = ? AND credential_version = ?`,
      [
        'session-stale',
        '2026-11-09T12:00:00.000Z',
        '2026-10-10T12:00:00.000Z',
        'user-target',
        4,
      ]
    );
  });
});

describe('recovery code consumption', () => {
  it('rolls back the session when another request already consumed the code', async () => {
    const db = {
      exec: vi.fn().mockResolvedValue(undefined),
      run: vi.fn()
        .mockResolvedValueOnce({ changes: 1 })
        .mockResolvedValueOnce({ changes: 0 }),
    };

    const created = await createSessionWithRecoveryCode({
      db,
      sessionId: 'session-loser',
      userId: 'user-target',
      credentialVersion: 4,
      expiresAt: '2026-11-09T12:00:00.000Z',
      createdAt: '2026-10-10T12:00:00.000Z',
      previousRecoveryCodesJson: '["AAAA-BBBB"]',
      remainingRecoveryCodesJson: '[]',
    });

    expect(created).toBe(false);
    expect(db.exec).toHaveBeenNthCalledWith(1, 'BEGIN IMMEDIATE TRANSACTION');
    expect(db.run).toHaveBeenNthCalledWith(
      2,
      `UPDATE users
       SET recovery_codes_json = ?
       WHERE id = ? AND credential_version = ? AND recovery_codes_json = ?`,
      ['[]', 'user-target', 4, '["AAAA-BBBB"]']
    );
    expect(db.exec).toHaveBeenNthCalledWith(2, 'ROLLBACK');
  });
});
