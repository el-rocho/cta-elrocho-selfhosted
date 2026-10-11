import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { generateSecret, generateURI, verify } from 'otplib';
import QRCode from 'qrcode';
import { getDB, openDatabaseConnection } from './db.js';
import {
  createSessionWithRecoveryCode as insertSessionWithRecoveryCode,
  insertSessionForCredentialVersion,
} from './credentialSecurity.js';

const SESSION_COOKIE_NAME = 'cta_session';
const SESSION_DURATION_DAYS = 30;

export async function deleteSessionBestEffort(db, sessionId) {
  try {
    await db.run('DELETE FROM sessions WHERE id = ?', [sessionId]);
  } catch (error) {
    console.error('No se pudo limpiar una sesión inválida:', error);
  }
}

export async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

export async function comparePassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

// Crear token y sesión única para un usuario
export async function createSession(userId, credentialVersion) {
  const db = await getDB();
  const sessionId = `sess-${crypto.randomBytes(24).toString('hex')}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const inserted = await insertSessionForCredentialVersion({
    db,
    sessionId,
    userId,
    credentialVersion,
    expiresAt,
    createdAt: now.toISOString(),
  });

  return inserted ? { sessionId, expiresAt } : null;
}

export async function createRecoveryCodeSession(
  userId,
  credentialVersion,
  previousRecoveryCodesJson,
  remainingRecoveryCodesJson
) {
  const db = await openDatabaseConnection();
  const sessionId = `sess-${crypto.randomBytes(24).toString('hex')}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  try {
    const inserted = await insertSessionWithRecoveryCode({
      db,
      sessionId,
      userId,
      credentialVersion,
      expiresAt,
      createdAt: now.toISOString(),
      previousRecoveryCodesJson,
      remainingRecoveryCodesJson,
    });

    return inserted ? { sessionId, expiresAt } : null;
  } finally {
    await db.close();
  }
}

export async function destroySession(sessionId) {
  if (!sessionId) return;
  const db = await getDB();
  await db.run('DELETE FROM sessions WHERE id = ?', [sessionId]);
}

// Obtener usuario autenticado por token de sesión
export async function getUserBySession(sessionId) {
  if (!sessionId) return null;
  const db = await getDB();
  const session = await db.get('SELECT * FROM sessions WHERE id = ?', [sessionId]);

  if (!session) return null;

  if (new Date(session.expires_at).getTime() < Date.now()) {
    await deleteSessionBestEffort(db, sessionId);
    return null;
  }

  const user = await db.get(
    'SELECT id, username, name, role, sex, birth_date, totp_enabled, credential_version, created_at FROM users WHERE id = ?',
    [session.user_id]
  );

  if (!user || Number(session.credential_version) !== Number(user.credential_version)) {
    await deleteSessionBestEffort(db, sessionId);
    return null;
  }

  const { credential_version: _credentialVersion, ...authenticatedUser } = user;
  return authenticatedUser;
}

// Obtener el token enviado explícitamente por clientes nativos o, como
// alternativa para navegador/PWA, el almacenado en la cookie HttpOnly.
export function getSessionId(req) {
  const headerToken = req.headers?.['x-session-token'];
  if (typeof headerToken === 'string' && headerToken.trim()) {
    return headerToken.trim();
  }

  const cookieToken = req.cookies?.[SESSION_COOKIE_NAME];
  return typeof cookieToken === 'string' && cookieToken.trim()
    ? cookieToken.trim()
    : undefined;
}

// Middleware para proteger rutas de la API
export async function requireAuth(req, res, next) {
  const sessionId = getSessionId(req);
  const user = await getUserBySession(sessionId);

  if (!user) {
    return res.status(401).json({ error: 'No autorizado. Inicia sesión para continuar.' });
  }

  req.user = user;
  next();
}

// Middleware exclusivo para administradores
export async function requireAdmin(req, res, next) {
  await requireAuth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de administrador.' });
    }
    next();
  });
}

// Lógica de 2FA / TOTP con otplib
export async function generateTotpSetup(username) {
  const secret = generateSecret();
  const otpauthUrl = generateURI({
    issuer: 'Control Tensión Arterial',
    label: username,
    secret,
  });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  return { secret, qrCodeDataUrl, otpauthUrl };
}

export async function verifyTotpToken(token, secret) {
  try {
    const cleanToken = String(token).trim();
    if (!cleanToken || !secret) return false;
    const result = await verify({
      token: cleanToken,
      secret,
      // Aceptar el intervalo inmediatamente anterior cubre el tiempo necesario
      // para leer y enviar el código sin aceptar códigos de intervalos futuros.
      epochTolerance: [30, 0],
    });
    return result.valid === true;
  } catch (err) {
    console.error('Error al verificar TOTP:', err);
    return false;
  }
}

export function generateRecoveryCodes(count = 8) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  return codes;
}

export { SESSION_COOKIE_NAME };
