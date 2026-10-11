async function cleanRevokedAccess({
  db,
  userId,
  pendingTotpLogins,
  onCleanupError = (error) => console.error('No se pudieron limpiar sesiones obsoletas:', error),
}) {
  for (const [token, pending] of pendingTotpLogins.entries()) {
    if (pending.userId === userId) {
      pendingTotpLogins.delete(token);
    }
  }

  try {
    await db.run(
      `DELETE FROM sessions
       WHERE user_id = ?
         AND credential_version < (
           SELECT credential_version FROM users WHERE id = ?
         )`,
      [userId, userId]
    );
  } catch (error) {
    onCleanupError(error);
  }
}

export async function replacePasswordAndRevokeAccess({
  db,
  userId,
  passwordHash,
  pendingTotpLogins,
  onCleanupError,
}) {
  const result = await db.run(
    `UPDATE users
     SET password_hash = ?, totp_pending_secret = NULL,
         credential_version = credential_version + 1
     WHERE id = ?`,
    [passwordHash, userId]
  );

  if (result.changes !== 1) return false;

  await cleanRevokedAccess({ db, userId, pendingTotpLogins, onCleanupError });
  return true;
}

export async function setPendingTotpSecretForSession({
  db,
  userId,
  sessionId,
  pendingSecret,
  nowIso,
}) {
  const result = await db.run(
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
    [pendingSecret, userId, sessionId, nowIso]
  );

  return result.changes === 1;
}

export async function activateTotpAndRevokeAccess({
  db,
  userId,
  verifiedSecret,
  recoveryCodesJson,
  sessionId,
  nowIso,
  pendingTotpLogins,
  onCleanupError,
}) {
  const result = await db.run(
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
    [verifiedSecret, recoveryCodesJson, userId, verifiedSecret, sessionId, nowIso]
  );

  if (result.changes !== 1) return false;

  await cleanRevokedAccess({ db, userId, pendingTotpLogins, onCleanupError });
  return true;
}

export async function disableTotpAndRevokeAccess({
  db,
  userId,
  sessionId,
  nowIso,
  pendingTotpLogins,
  onCleanupError,
}) {
  const result = await db.run(
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
    [userId, sessionId, nowIso]
  );

  if (result.changes !== 1) return false;

  await cleanRevokedAccess({ db, userId, pendingTotpLogins, onCleanupError });
  return true;
}

export async function insertSessionForCredentialVersion({
  db,
  sessionId,
  userId,
  credentialVersion,
  expiresAt,
  createdAt,
}) {
  const result = await db.run(
    `INSERT INTO sessions (id, user_id, credential_version, expires_at, created_at)
     SELECT ?, id, credential_version, ?, ?
     FROM users
     WHERE id = ? AND credential_version = ?`,
    [sessionId, expiresAt, createdAt, userId, credentialVersion]
  );

  return result.changes === 1;
}

export async function createSessionWithRecoveryCode({
  db,
  sessionId,
  userId,
  credentialVersion,
  expiresAt,
  createdAt,
  previousRecoveryCodesJson,
  remainingRecoveryCodesJson,
}) {
  await db.exec('BEGIN IMMEDIATE TRANSACTION');
  try {
    const inserted = await insertSessionForCredentialVersion({
      db,
      sessionId,
      userId,
      credentialVersion,
      expiresAt,
      createdAt,
    });
    if (!inserted) {
      await db.exec('ROLLBACK');
      return false;
    }

    const consumed = await db.run(
      `UPDATE users
       SET recovery_codes_json = ?
       WHERE id = ? AND credential_version = ? AND recovery_codes_json = ?`,
      [remainingRecoveryCodesJson, userId, credentialVersion, previousRecoveryCodesJson]
    );

    if (consumed.changes !== 1) {
      await db.exec('ROLLBACK');
      return false;
    }

    await db.exec('COMMIT');
    return true;
  } catch (error) {
    try {
      await db.exec('ROLLBACK');
    } catch {
      // La transacción puede haberse cerrado por el propio error de SQLite.
    }
    throw error;
  }
}
