import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { getDB, DATA_DIR, DB_PATH, BACKUPS_DIR } from './db.js';
import { createHealthHandler } from './health.js';
import {
  createApiActivityMonitor,
  createProcessCpuSampler,
  createSystemStatusHandler,
} from './systemStatus.js';
import {
  hashPassword,
  comparePassword,
  createSession,
  destroySession,
  getSessionId,
  getUserBySession,
  requireAuth,
  requireAdmin,
  generateTotpSetup,
  verifyTotpToken,
  generateRecoveryCodes,
  SESSION_COOKIE_NAME,
} from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const packageInfo = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
const APP_VERSION = process.env.APP_VERSION || packageInfo.version || 'unknown';
const apiActivityMonitor = createApiActivityMonitor();
const sampleProcessCpu = createProcessCpuSampler();

const LEGACY_DEMO_NOTES = {
  'Ejemplo verde: óptima sin medicación': 'Ejemplo: 115/75 mmHg, sin medicación',
  'Ejemplo verde: óptima con medicación': 'Ejemplo: 120/70 mmHg, con medicación',
  'Ejemplo azul: hipotensión con taquicardia': 'Ejemplo: 88/58 mmHg y pulso de 105 lpm',
  'Ejemplo turquesa: subóptima con medicación': 'Ejemplo: 110/62 mmHg, con medicación',
  'Ejemplo naranja: presión elevada sin medicación': 'Ejemplo: 130/82 mmHg, sin medicación',
  'Ejemplo naranja: franja elevada con medicación': 'Ejemplo: 128/78 mmHg, con medicación',
  'Ejemplo rojo: sistólica elevada': 'Ejemplo: 138/82 mmHg, sin medicación',
  'Ejemplo rojo: diastólica elevada con taquicardia':
    'Ejemplo: 125/88 mmHg, con medicación y pulso de 106 lpm',
  'Ejemplo: presión de pulso estrecha y bradicardia':
    'Ejemplo: presión de pulso de 22 mmHg y pulso de 48 lpm',
  'Ejemplo rojo: ambos valores elevados y presión de pulso amplia':
    'Ejemplo: presión de pulso de 65 mmHg',
};

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));

// Los datos de salud y de sesión nunca deben reutilizarse entre usuarios.
// Esto también protege a clientes PWA y proxies intermedios que, de otro modo,
// podrían almacenar una respuesta GET autenticada usando únicamente la URL.
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.vary('x-session-token');
  res.vary('Cookie');
  next();
});
app.use('/api', apiActivityMonitor.middleware);

// Comprobación pública y mínima de disponibilidad del servidor y SQLite.
app.get('/api/health', createHealthHandler(getDB));
app.get('/api/admin/system-status', requireAdmin, createSystemStatusHandler({
  getDatabase: getDB,
  dataDir: DATA_DIR,
  databasePath: DB_PATH,
  appVersion: APP_VERSION,
  apiActivity: apiActivityMonitor,
  sampleCpu: sampleProcessCpu,
}));

// Tokens temporales para flujo 2FA durante el login (validez 5 minutos)
const pendingTotpLogins = new Map();

function validateReadingInput(input, requirePulsePressureConfirmation = true) {
  const systolic = Number(input.systolic);
  const diastolic = Number(input.diastolic);
  const heartRate = Number(input.heartRate);

  if (
    !Number.isInteger(systolic) ||
    !Number.isInteger(diastolic) ||
    !Number.isInteger(heartRate) ||
    systolic < 50 ||
    systolic > 260 ||
    diastolic < 30 ||
    diastolic > 160 ||
    heartRate < 30 ||
    heartRate > 220
  ) {
    return { error: 'Valores fuera de los límites admitidos.' };
  }
  if (diastolic >= systolic) {
    return { error: 'La presión diastólica debe ser menor que la sistólica.' };
  }

  const pulsePressure = systolic - diastolic;
  const pulsePressureWarningConfirmed = input.pulsePressureWarningConfirmed === true;
  if (
    requirePulsePressureConfirmation &&
    (pulsePressure < 25 || pulsePressure > 60) &&
    !pulsePressureWarningConfirmed
  ) {
    return {
      error: 'Confirma la revisión del manguito antes de guardar esta presión de pulso.',
      code: 'PULSE_PRESSURE_CONFIRMATION_REQUIRED',
    };
  }

  return { systolic, diastolic, heartRate, pulsePressureWarningConfirmed };
}

function serializeReadingRow(row) {
  return {
    ...row,
    pulsePressureWarningConfirmed: Boolean(row.pulsePressureWarningConfirmed),
    takesAntihypertensiveMedication: Boolean(row.takesAntihypertensiveMedication),
  };
}

async function migrateDemoReadingNotes(db, rows) {
  const migratedRows = [];
  for (const row of rows) {
    const migratedNote = row.id.startsWith('demo-') && row.notes
      ? LEGACY_DEMO_NOTES[row.notes]
      : undefined;
    if (!migratedNote) {
      migratedRows.push(row);
      continue;
    }
    await db.run('UPDATE readings SET notes = ? WHERE id = ? AND notes = ?', [
      migratedNote,
      row.id,
      row.notes,
    ]);
    migratedRows.push({ ...row, notes: migratedNote });
  }
  return migratedRows;
}

async function getCurrentMedicationContext(db, userId) {
  const row = await db.get(
    'SELECT takes_antihypertensive_medication FROM settings WHERE user_id = ?',
    [userId]
  );
  return Boolean(row?.takes_antihypertensive_medication);
}

// Helper para guardar cookie de sesión
function setSessionCookie(res, req, sessionId) {
  const isHttps = req ? (req.secure || req.headers['x-forwarded-proto'] === 'https') : false;
  const isSecure = process.env.COOKIE_SECURE === 'true' || isHttps;
  res.cookie(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecure,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 días
  });
}

// -----------------------------------------------------------------------------
// ENDPOINTS DE AUTENTICACIÓN
// -----------------------------------------------------------------------------

// Verificar estado del sistema
app.get('/api/auth/status', async (req, res) => {
  try {
    const db = await getDB();
    const countRes = await db.get('SELECT COUNT(*) as count FROM users');
    const userCount = countRes ? countRes.count : 0;

    const sessionId = getSessionId(req);
    const user = await getUserBySession(sessionId);

    res.json({
      hasAdmin: userCount > 0,
      userCount,
      user: user || null,
    });
  } catch (error) {
    console.error('Error al verificar estado de auth:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Crear primer usuario Administrador del sistema
app.post('/api/auth/setup-admin', async (req, res) => {
  try {
    const db = await getDB();
    const countRes = await db.get('SELECT COUNT(*) as count FROM users');
    if (countRes.count > 0) {
      return res.status(400).json({ error: 'El administrador inicial ya ha sido configurado.' });
    }

    const { username, name, password, sex, birthDate } = req.body;
    if (!username || !password || !name) {
      return res.status(400).json({ error: 'Todos los campos (usuario, nombre, contraseña) son obligatorios.' });
    }

    const userId = `usr-admin-${Date.now()}`;
    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();
    const cleanSex = sex || '';
    const cleanBirthDate = birthDate || '';

    await db.run(
      'INSERT INTO users (id, username, name, password_hash, role, sex, birth_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, username.trim().toLowerCase(), name.trim(), passwordHash, 'admin', cleanSex, cleanBirthDate, now]
    );

    // Ajustes iniciales
    await db.run(
      'INSERT INTO settings (user_id, language, enable_white_coat, white_coat_minutes, default_arm, preferred_input_mode, patient_name, patient_sex, patient_birth_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, 'es', 0, 5, 'left', 'keyboard', name.trim(), cleanSex, cleanBirthDate]
    );

    // Iniciar sesión automáticamente
    const { sessionId } = await createSession(userId);
    setSessionCookie(res, req, sessionId);

    const user = await db.get(
      'SELECT id, username, name, role, sex, birth_date, totp_enabled, created_at FROM users WHERE id = ?',
      [userId]
    );

    res.status(201).json({ success: true, user, token: sessionId });
  } catch (error) {
    console.error('Error al crear administrador inicial:', error);
    res.status(500).json({ error: 'Error al registrar administrador inicial' });
  }
});

// Inicio de Sesión (Paso 1: Nombre de Usuario + Contraseña)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Introduce el nombre de usuario y la contraseña.' });
    }

    const db = await getDB();
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username.trim().toLowerCase()]);

    if (!user) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }

    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }

    // Si tiene 2FA TOTP activo, solicitar código en Paso 2
    if (user.totp_enabled && user.totp_secret) {
      const tempToken = `totp-temp-${crypto.randomBytes(16).toString('hex')}`;
      pendingTotpLogins.set(tempToken, {
        userId: user.id,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });

      return res.json({
        requires2FA: true,
        tempToken,
        message: 'Introduce tu código de verificación de 6 dígitos de tu app de autenticación.',
      });
    }

    // Sin 2FA: Iniciar sesión directamente
    const { sessionId } = await createSession(user.id);
    setSessionCookie(res, req, sessionId);

    res.json({
      success: true,
      token: sessionId,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        sex: user.sex || '',
        birth_date: user.birth_date || '',
        totp_enabled: Boolean(user.totp_enabled),
        created_at: user.created_at,
      },
    });
  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    res.status(500).json({ error: 'Error en el inicio de sesión' });
  }
});

// Inicio de Sesión (Paso 2: Código TOTP)
app.post('/api/auth/login/totp', async (req, res) => {
  try {
    const { tempToken, code } = req.body;
    if (!tempToken || !code) {
      return res.status(400).json({ error: 'Falta el token de sesión o el código de verificación.' });
    }

    const pending = pendingTotpLogins.get(tempToken);
    if (!pending || pending.expiresAt < Date.now()) {
      pendingTotpLogins.delete(tempToken);
      return res.status(401).json({ error: 'La sesión de verificación ha expirado. Inicia sesión de nuevo.' });
    }

    const db = await getDB();
    const user = await db.get('SELECT * FROM users WHERE id = ?', [pending.userId]);

    if (!user || !user.totp_secret) {
      return res.status(400).json({ error: 'Usuario no válido.' });
    }

    const cleanCode = String(code).trim();
    let isValidCode = verifyTotpToken(cleanCode, user.totp_secret);

    if (!isValidCode && user.recovery_codes_json) {
      try {
        const recoveryCodes = JSON.parse(user.recovery_codes_json);
        const codeIndex = recoveryCodes.findIndex((c) => c.toUpperCase() === cleanCode.toUpperCase());
        if (codeIndex !== -1) {
          isValidCode = true;
          recoveryCodes.splice(codeIndex, 1);
          await db.run('UPDATE users SET recovery_codes_json = ? WHERE id = ?', [
            JSON.stringify(recoveryCodes),
            user.id,
          ]);
        }
      } catch (err) {
        console.error('Error al verificar código de recuperación:', err);
      }
    }

    if (!isValidCode) {
      return res.status(401).json({ error: 'Código de verificación o de recuperación no válido.' });
    }

    pendingTotpLogins.delete(tempToken);
    const { sessionId } = await createSession(user.id);
    setSessionCookie(res, req, sessionId);

    res.json({
      success: true,
      token: sessionId,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        sex: user.sex || '',
        birth_date: user.birth_date || '',
        totp_enabled: Boolean(user.totp_enabled),
        created_at: user.created_at,
      },
    });
  } catch (error) {
    console.error('Error al verificar TOTP:', error);
    res.status(500).json({ error: 'Error al verificar el código de 2FA' });
  }
});

// Cerrar Sesión
app.post('/api/auth/logout', async (req, res) => {
  const sessionId = getSessionId(req);
  if (sessionId) {
    await destroySession(sessionId);
  }
  res.clearCookie(SESSION_COOKIE_NAME);
  res.json({ success: true });
});

// Obtener datos del usuario autenticado actual
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json(req.user);
});

// -----------------------------------------------------------------------------
// ENDPOINTS DE CONFIGURACIÓN TOTP (2FA)
// -----------------------------------------------------------------------------

app.post('/api/auth/totp/setup', requireAuth, async (req, res) => {
  try {
    const { secret, qrCodeDataUrl } = await generateTotpSetup(req.user.username);
    const db = await getDB();
    // Conservar el secreto activo hasta que el usuario valide el nuevo.
    // Así, cancelar una reconfiguración no bloquea el siguiente inicio de sesión.
    await db.run('UPDATE users SET totp_pending_secret = ? WHERE id = ?', [secret, req.user.id]);
    res.json({ secret, qrCodeDataUrl });
  } catch (error) {
    console.error('Error al generar TOTP setup:', error);
    res.status(500).json({ error: 'Error al configurar 2FA' });
  }
});

app.post('/api/auth/totp/verify', requireAuth, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Introduce el código de 6 dígitos.' });

    const db = await getDB();
    const user = await db.get('SELECT totp_pending_secret FROM users WHERE id = ?', [req.user.id]);

    if (!user || !user.totp_pending_secret) {
      return res.status(400).json({ error: 'Inicia la configuración de 2FA primero.' });
    }

    const isValid = verifyTotpToken(code, user.totp_pending_secret);
    if (!isValid) {
      return res.status(400).json({ error: 'Código incorrecto. Verifica la hora de tu teléfono.' });
    }

    const recoveryCodes = generateRecoveryCodes(8);

    await db.run(
      'UPDATE users SET totp_secret = ?, totp_pending_secret = NULL, totp_enabled = 1, recovery_codes_json = ? WHERE id = ?',
      [user.totp_pending_secret, JSON.stringify(recoveryCodes), req.user.id]
    );

    res.json({
      success: true,
      recoveryCodes,
    });
  } catch (error) {
    console.error('Error al activar 2FA:', error);
    res.status(500).json({ error: 'Error al activar 2FA' });
  }
});

app.post('/api/auth/totp/disable', requireAuth, async (req, res) => {
  try {
    const db = await getDB();
    await db.run(
      'UPDATE users SET totp_enabled = 0, totp_secret = NULL, totp_pending_secret = NULL, recovery_codes_json = NULL WHERE id = ?',
      [req.user.id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error al desactivar 2FA:', error);
    res.status(500).json({ error: 'Error al desactivar 2FA' });
  }
});

// -----------------------------------------------------------------------------
// ENDPOINTS DE GESTIÓN DE USUARIOS (Solo Administrador)
// -----------------------------------------------------------------------------

app.get('/api/users', requireAdmin, async (req, res) => {
  try {
    const db = await getDB();
    const users = await db.all(
      'SELECT id, username, name, role, sex, birth_date, totp_enabled, created_at FROM users ORDER BY created_at ASC'
    );
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Error al listar usuarios' });
  }
});

app.post('/api/users', requireAdmin, async (req, res) => {
  try {
    const { username, name, password, role, sex, birthDate } = req.body;
    if (!username || !password || !name) {
      return res.status(400).json({ error: 'Los campos usuario, nombre y contraseña son obligatorios.' });
    }

    const db = await getDB();
    const existing = await db.get('SELECT id FROM users WHERE username = ?', [username.trim().toLowerCase()]);
    if (existing) {
      return res.status(400).json({ error: 'El nombre de usuario ya existe.' });
    }

    const userId = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const passwordHash = await hashPassword(password);
    const userRole = role === 'admin' ? 'admin' : 'user';
    const now = new Date().toISOString();
    const cleanSex = sex || '';
    const cleanBirthDate = birthDate || '';

    await db.run(
      'INSERT INTO users (id, username, name, password_hash, role, sex, birth_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, username.trim().toLowerCase(), name.trim(), passwordHash, userRole, cleanSex, cleanBirthDate, now]
    );

    await db.run(
      'INSERT INTO settings (user_id, language, enable_white_coat, white_coat_minutes, default_arm, preferred_input_mode, patient_name, patient_sex, patient_birth_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, 'es', 0, 5, 'left', 'keyboard', name.trim(), cleanSex, cleanBirthDate]
    );

    const created = await db.get(
      'SELECT id, username, name, role, sex, birth_date, totp_enabled, created_at FROM users WHERE id = ?',
      [userId]
    );

    res.status(201).json(created);
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

app.delete('/api/users/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (id === req.user.id) {
      return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta de administrador.' });
    }

    const db = await getDB();
    await db.run('DELETE FROM users WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

app.post('/api/users/:id/reset-password', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 4 caracteres.' });
    }

    const db = await getDB();
    const passwordHash = await hashPassword(newPassword);
    await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al restablecer la contraseña' });
  }
});

// -----------------------------------------------------------------------------
// ENDPOINTS DE MEDICIONES Y AJUSTES (Aislados por usuario autenticado)
// -----------------------------------------------------------------------------

app.get('/api/readings', requireAuth, async (req, res) => {
  try {
    const db = await getDB();
    const rows = await db.all(
      'SELECT id, timestamp, systolic, diastolic, heart_rate as heartRate, arm, notes, pulse_pressure_confirmed as pulsePressureWarningConfirmed, takes_antihypertensive_medication as takesAntihypertensiveMedication FROM readings WHERE user_id = ? ORDER BY timestamp DESC',
      [req.user.id]
    );
    const migratedRows = await migrateDemoReadingNotes(db, rows);
    res.json(migratedRows.map(serializeReadingRow));
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener mediciones' });
  }
});

app.post('/api/readings', requireAuth, async (req, res) => {
  try {
    const { arm, notes } = req.body;
    const validation = validateReadingInput(req.body);
    if (validation.error) return res.status(validation.code ? 409 : 400).json(validation);

    const db = await getDB();
    const takesAntihypertensiveMedication =
      typeof req.body.takesAntihypertensiveMedication === 'boolean'
        ? req.body.takesAntihypertensiveMedication
        : await getCurrentMedicationContext(db, req.user.id);
    const newReading = {
      id: `bp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      user_id: req.user.id,
      timestamp: new Date().toISOString(),
      systolic: validation.systolic,
      diastolic: validation.diastolic,
      heartRate: validation.heartRate,
      arm: arm || 'left',
      notes: notes ? String(notes).trim() : null,
      pulsePressureWarningConfirmed: validation.pulsePressureWarningConfirmed,
      takesAntihypertensiveMedication,
      created_at: new Date().toISOString(),
    };

    await db.run(
      'INSERT INTO readings (id, user_id, timestamp, systolic, diastolic, heart_rate, arm, notes, pulse_pressure_confirmed, takes_antihypertensive_medication, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        newReading.id,
        newReading.user_id,
        newReading.timestamp,
        newReading.systolic,
        newReading.diastolic,
        newReading.heartRate,
        newReading.arm,
        newReading.notes,
        newReading.pulsePressureWarningConfirmed ? 1 : 0,
        newReading.takesAntihypertensiveMedication ? 1 : 0,
        newReading.created_at,
      ]
    );

    res.status(201).json({
      id: newReading.id,
      timestamp: newReading.timestamp,
      systolic: newReading.systolic,
      diastolic: newReading.diastolic,
      heartRate: newReading.heartRate,
      arm: newReading.arm,
      notes: newReading.notes || undefined,
      pulsePressureWarningConfirmed: newReading.pulsePressureWarningConfirmed,
      takesAntihypertensiveMedication: newReading.takesAntihypertensiveMedication,
    });
  } catch (error) {
    console.error('Error al guardar medición:', error);
    res.status(500).json({ error: 'Error al guardar la medición' });
  }
});

app.put('/api/readings/medication-context', requireAuth, async (req, res) => {
  try {
    if (typeof req.body.takesAntihypertensiveMedication !== 'boolean') {
      return res.status(400).json({ error: 'Contexto de medicación inválido' });
    }
    const db = await getDB();
    const value = req.body.takesAntihypertensiveMedication ? 1 : 0;
    await db.exec('BEGIN');
    try {
      await db.run(
        `INSERT INTO settings (user_id, takes_antihypertensive_medication)
         VALUES (?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           takes_antihypertensive_medication = excluded.takes_antihypertensive_medication`,
        [req.user.id, value]
      );
      await db.run(
        'UPDATE readings SET takes_antihypertensive_medication = ? WHERE user_id = ?',
        [value, req.user.id]
      );
      await db.exec('COMMIT');
    } catch (error) {
      await db.exec('ROLLBACK');
      throw error;
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar el contexto del historial' });
  }
});

app.put('/api/readings/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const db = await getDB();

    const existing = await db.get('SELECT * FROM readings WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Toma no encontrada' });
    }

    const validation = validateReadingInput(req.body);
    if (validation.error) return res.status(validation.code ? 409 : 400).json(validation);
    const cleanNotes = notes ? String(notes).trim() : null;
    const takesAntihypertensiveMedication =
      typeof req.body.takesAntihypertensiveMedication === 'boolean'
        ? req.body.takesAntihypertensiveMedication
        : Boolean(existing.takes_antihypertensive_medication);

    await db.run(
      'UPDATE readings SET systolic = ?, diastolic = ?, heart_rate = ?, notes = ?, pulse_pressure_confirmed = ?, takes_antihypertensive_medication = ? WHERE id = ? AND user_id = ?',
      [validation.systolic, validation.diastolic, validation.heartRate, cleanNotes, validation.pulsePressureWarningConfirmed ? 1 : 0, takesAntihypertensiveMedication ? 1 : 0, id, req.user.id]
    );

    res.json({
      ...existing,
      systolic: validation.systolic,
      diastolic: validation.diastolic,
      heartRate: validation.heartRate,
      notes: cleanNotes || undefined,
      pulsePressureWarningConfirmed: validation.pulsePressureWarningConfirmed,
      takesAntihypertensiveMedication,
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar la toma' });
  }
});

app.delete('/api/readings/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDB();
    await db.run('DELETE FROM readings WHERE id = ? AND user_id = ?', [id, req.user.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar la toma' });
  }
});

app.post('/api/sessions/delete', requireAuth, async (req, res) => {
  try {
    const { readingIds } = req.body;
    if (!Array.isArray(readingIds)) {
      return res.status(400).json({ error: 'readingIds debe ser un array' });
    }
    const db = await getDB();
    const placeholders = readingIds.map(() => '?').join(',');
    await db.run(
      `DELETE FROM readings WHERE user_id = ? AND id IN (${placeholders})`,
      [req.user.id, ...readingIds]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar la sesión' });
  }
});

app.delete('/api/readings/all/confirm', requireAuth, async (req, res) => {
  try {
    const db = await getDB();
    await db.run('DELETE FROM readings WHERE user_id = ?', [req.user.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al borrar historial' });
  }
});

app.post('/api/readings/reset-demo', requireAuth, async (req, res) => {
  try {
    const db = await getDB();
    await db.run('DELETE FROM readings WHERE user_id = ?', [req.user.id]);

    const nowMs = Date.now();
    const dayMs = 1000 * 60 * 60 * 24;
    const demoItems = [
      {
        id: 'demo-optimal-unmedicated',
        daysAgo: 0,
        systolic: 115,
        diastolic: 75,
        heart_rate: 72,
        arm: 'left',
    notes: 'Ejemplo: 115/75 mmHg, sin medicación',
        pulse_pressure_confirmed: 0,
        takes_antihypertensive_medication: 0,
      },
      {
        id: 'demo-optimal-medicated',
        daysAgo: 2,
        systolic: 120,
        diastolic: 70,
        heart_rate: 68,
        arm: 'right',
    notes: 'Ejemplo: 120/70 mmHg, con medicación',
        pulse_pressure_confirmed: 0,
        takes_antihypertensive_medication: 1,
      },
      {
        id: 'demo-hypotension',
        daysAgo: 6,
        systolic: 88,
        diastolic: 58,
        heart_rate: 105,
        arm: 'left',
    notes: 'Ejemplo: 88/58 mmHg y pulso de 105 lpm',
        pulse_pressure_confirmed: 0,
        takes_antihypertensive_medication: 0,
      },
      {
        id: 'demo-suboptimal-medicated',
        daysAgo: 10,
        systolic: 110,
        diastolic: 62,
        heart_rate: 66,
        arm: 'right',
    notes: 'Ejemplo: 110/62 mmHg, con medicación',
        pulse_pressure_confirmed: 0,
        takes_antihypertensive_medication: 1,
      },
      {
        id: 'demo-elevated-unmedicated',
        daysAgo: 20,
        systolic: 130,
        diastolic: 82,
        heart_rate: 74,
        arm: 'left',
    notes: 'Ejemplo: 130/82 mmHg, sin medicación',
        pulse_pressure_confirmed: 0,
        takes_antihypertensive_medication: 0,
      },
      {
        id: 'demo-elevated-medicated',
        daysAgo: 45,
        systolic: 128,
        diastolic: 78,
        heart_rate: 76,
        arm: 'right',
    notes: 'Ejemplo: 128/78 mmHg, con medicación',
        pulse_pressure_confirmed: 0,
        takes_antihypertensive_medication: 1,
      },
      {
        id: 'demo-hypertension-systolic',
        daysAgo: 75,
        systolic: 138,
        diastolic: 82,
        heart_rate: 72,
        arm: 'left',
    notes: 'Ejemplo: 138/82 mmHg, sin medicación',
        pulse_pressure_confirmed: 0,
        takes_antihypertensive_medication: 0,
      },
      {
        id: 'demo-hypertension-diastolic',
        daysAgo: 100,
        systolic: 125,
        diastolic: 88,
        heart_rate: 106,
        arm: 'right',
    notes: 'Ejemplo: 125/88 mmHg, con medicación y pulso de 106 lpm',
        pulse_pressure_confirmed: 0,
        takes_antihypertensive_medication: 1,
      },
      {
        id: 'demo-narrow-pulse-pressure',
        daysAgo: 180,
        systolic: 100,
        diastolic: 78,
        heart_rate: 48,
        arm: 'left',
    notes: 'Ejemplo: presión de pulso de 22 mmHg y pulso de 48 lpm',
        pulse_pressure_confirmed: 1,
        takes_antihypertensive_medication: 0,
      },
      {
        id: 'demo-wide-pulse-pressure',
        daysAgo: 365,
        systolic: 150,
        diastolic: 85,
        heart_rate: 70,
        arm: 'right',
    notes: 'Ejemplo: presión de pulso de 65 mmHg',
        pulse_pressure_confirmed: 1,
        takes_antihypertensive_medication: 0,
      },
    ].map((item) => {
      const timestamp = new Date(nowMs - dayMs * item.daysAgo).toISOString();
      return {
        ...item,
        id: `${item.id}-${req.user.id}`,
        user_id: req.user.id,
        timestamp,
        created_at: timestamp,
      };
    });

    for (const item of demoItems) {
      await db.run(
        'INSERT INTO readings (id, user_id, timestamp, systolic, diastolic, heart_rate, arm, notes, pulse_pressure_confirmed, takes_antihypertensive_medication, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          item.id,
          item.user_id,
          item.timestamp,
          item.systolic,
          item.diastolic,
          item.heart_rate,
          item.arm,
          item.notes,
          item.pulse_pressure_confirmed,
          item.takes_antihypertensive_medication,
          item.created_at,
        ]
      );
    }

    const updatedRows = await db.all(
      'SELECT id, timestamp, systolic, diastolic, heart_rate as heartRate, arm, notes, pulse_pressure_confirmed as pulsePressureWarningConfirmed, takes_antihypertensive_medication as takesAntihypertensiveMedication FROM readings WHERE user_id = ? ORDER BY timestamp DESC',
      [req.user.id]
    );

    res.json(updatedRows.map(serializeReadingRow));
  } catch (error) {
    console.error('Error al restaurar datos de demostración:', error);
    res.status(500).json({ error: 'Error al restaurar datos demo' });
  }
});

app.post('/api/readings/import', requireAuth, async (req, res) => {
  try {
    const importedItems = req.body;
    if (!Array.isArray(importedItems)) {
      return res.status(400).json({ error: 'Formato inválido para importación' });
    }

    const db = await getDB();
    const currentMedicationContext = await getCurrentMedicationContext(db, req.user.id);
    const current = await db.all('SELECT * FROM readings WHERE user_id = ?', [req.user.id]);
    const existingSigs = new Set(
      current.map((r) => `${new Date(r.timestamp).toISOString().slice(0, 16)}_${r.systolic}_${r.diastolic}_${r.heart_rate}`)
    );

    let addedCount = 0;
    const now = new Date().toISOString();

    await db.exec('BEGIN');
    try {
      for (const item of importedItems) {
        const validation = validateReadingInput(item, false);
        if (validation.error) continue;
        const sig = `${new Date(item.timestamp).toISOString().slice(0, 16)}_${item.systolic}_${item.diastolic}_${item.heartRate}`;
        if (!existingSigs.has(sig)) {
          existingSigs.add(sig);
          addedCount++;
          const id = `imp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          const takesAntihypertensiveMedication =
            typeof item.takesAntihypertensiveMedication === 'boolean'
              ? item.takesAntihypertensiveMedication
              : currentMedicationContext;
          await db.run(
            'INSERT INTO readings (id, user_id, timestamp, systolic, diastolic, heart_rate, arm, notes, pulse_pressure_confirmed, takes_antihypertensive_medication, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              id,
              req.user.id,
              item.timestamp,
              validation.systolic,
              validation.diastolic,
              validation.heartRate,
              item.arm || 'left',
              item.notes ? String(item.notes).trim() : null,
              validation.pulsePressureWarningConfirmed ? 1 : 0,
              takesAntihypertensiveMedication ? 1 : 0,
              now,
            ]
          );
        }
      }
      await db.exec('COMMIT');
    } catch (error) {
      await db.exec('ROLLBACK');
      throw error;
    }

    const updatedRows = await db.all(
      'SELECT id, timestamp, systolic, diastolic, heart_rate as heartRate, arm, notes, pulse_pressure_confirmed as pulsePressureWarningConfirmed, takes_antihypertensive_medication as takesAntihypertensiveMedication FROM readings WHERE user_id = ? ORDER BY timestamp DESC',
      [req.user.id]
    );

    const readings = updatedRows.map(serializeReadingRow);
    res.json({ addedCount, total: readings.length, readings });
  } catch (error) {
    res.status(500).json({ error: 'Error al importar mediciones' });
  }
});

app.get('/api/settings', requireAuth, async (req, res) => {
  try {
    const db = await getDB();
    const row = await db.get('SELECT * FROM settings WHERE user_id = ?', [req.user.id]);

    res.json({
      language: row?.language || 'es',
      enableWhiteCoatFilter: Boolean(row?.enable_white_coat),
      whiteCoatIntervalMinutes: 5,
      defaultArm: row?.default_arm || 'left',
      preferredInputMode: row?.preferred_input_mode || 'keyboard',
      guidelineProfile: row?.guideline_profile || 'esc-2024',
      treatmentTargetMode: row?.treatment_target_mode || 'guideline',
      customTargetSystolicMin: row?.custom_target_systolic_min ?? 120,
      customTargetSystolicMax: row?.custom_target_systolic_max ?? 129,
      customTargetDiastolicMin: row?.custom_target_diastolic_min ?? 70,
      customTargetDiastolicMax: row?.custom_target_diastolic_max ?? 79,
      patientName: row?.patient_name || req.user.name || '',
      patientSex: row?.patient_sex || req.user.sex || '',
      patientAge: row?.patient_age === null || row?.patient_age === undefined || row?.patient_age === ''
        ? ''
        : Number(row.patient_age),
      patientBirthDate: row?.patient_birth_date || req.user.birth_date || '',
      takesAntihypertensiveMedication: Boolean(row?.takes_antihypertensive_medication),
      backupFrequency: row?.backup_frequency || 'disabled',
      backupFolder: row?.backup_folder || 'Descargas/Copias_Tension_Arterial',
      lastBackupTimestamp: row?.last_backup_timestamp || undefined,
      lastFullBackupTimestamp: row?.last_full_backup_timestamp || undefined,
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener ajustes' });
  }
});

app.post('/api/settings', requireAuth, async (req, res) => {
  try {
    const s = req.body;
    const db = await getDB();

    await db.run(
      `INSERT INTO settings (
        user_id, language, enable_white_coat, white_coat_minutes, default_arm, preferred_input_mode,
        guideline_profile, treatment_target_mode, custom_target_systolic_min, custom_target_systolic_max,
        custom_target_diastolic_min, custom_target_diastolic_max,
        patient_name, patient_sex, patient_age, patient_birth_date, takes_antihypertensive_medication,
        backup_frequency, backup_folder, last_backup_timestamp, last_full_backup_timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        language = excluded.language,
        enable_white_coat = excluded.enable_white_coat,
        white_coat_minutes = excluded.white_coat_minutes,
        default_arm = excluded.default_arm,
        preferred_input_mode = excluded.preferred_input_mode,
        guideline_profile = excluded.guideline_profile,
        treatment_target_mode = excluded.treatment_target_mode,
        custom_target_systolic_min = excluded.custom_target_systolic_min,
        custom_target_systolic_max = excluded.custom_target_systolic_max,
        custom_target_diastolic_min = excluded.custom_target_diastolic_min,
        custom_target_diastolic_max = excluded.custom_target_diastolic_max,
        patient_name = excluded.patient_name,
        patient_sex = excluded.patient_sex,
        patient_age = excluded.patient_age,
        patient_birth_date = excluded.patient_birth_date,
        takes_antihypertensive_medication = excluded.takes_antihypertensive_medication,
        backup_frequency = excluded.backup_frequency,
        backup_folder = excluded.backup_folder,
        last_backup_timestamp = excluded.last_backup_timestamp,
        last_full_backup_timestamp = excluded.last_full_backup_timestamp;`,
      [
        req.user.id,
        s.language || 'es',
        s.enableWhiteCoatFilter ? 1 : 0,
        5,
        s.defaultArm || 'left',
        s.preferredInputMode || 'keyboard',
        ['esc-2024', 'aha-acc-2025', 'ish-2020'].includes(s.guidelineProfile) ? s.guidelineProfile : 'esc-2024',
        s.treatmentTargetMode === 'custom' ? 'custom' : 'guideline',
        Number.isFinite(s.customTargetSystolicMin) ? s.customTargetSystolicMin : 120,
        Number.isFinite(s.customTargetSystolicMax) ? s.customTargetSystolicMax : 129,
        Number.isFinite(s.customTargetDiastolicMin) ? s.customTargetDiastolicMin : 70,
        Number.isFinite(s.customTargetDiastolicMax) ? s.customTargetDiastolicMax : 79,
        s.patientName || req.user.name || '',
        s.patientSex || req.user.sex || '',
        s.patientAge || '',
        s.patientBirthDate || req.user.birth_date || '',
        s.takesAntihypertensiveMedication ? 1 : 0,
        s.backupFrequency || 'disabled',
        s.backupFolder || 'Descargas/Copias_Tension_Arterial',
        s.lastBackupTimestamp || null,
        s.lastFullBackupTimestamp || null,
      ]
    );

    // Mantener sincronizada la tabla users si se cambia el nombre, género o fecha de nacimiento
    if (s.patientName || s.patientSex || s.patientBirthDate) {
      await db.run(
        'UPDATE users SET name = COALESCE(?, name), sex = COALESCE(?, sex), birth_date = COALESCE(?, birth_date) WHERE id = ?',
        [s.patientName || null, s.patientSex || null, s.patientBirthDate || null, req.user.id]
      );
    }

    res.json({ success: true, settings: { ...s, whiteCoatIntervalMinutes: 5 } });
  } catch (error) {
    console.error('Error al guardar ajustes:', error);
    res.status(500).json({ error: 'Error al guardar ajustes' });
  }
});

app.post('/api/backups/generate', requireAuth, async (req, res) => {
  try {
    const { csvContent, filenamePrefix } = req.body;
    const now = new Date();
    const dateTimeStr = now.toISOString().replace(/[:.]/g, '-');
    const filename = `${filenamePrefix || 'tension_arterial'}_${req.user.username}_${dateTimeStr}.csv`;
    const filePath = path.join(BACKUPS_DIR, filename);

    if (csvContent) {
      fs.writeFileSync(filePath, csvContent, 'utf-8');
    }

    const db = await getDB();
    await db.run('UPDATE settings SET last_backup_timestamp = ? WHERE user_id = ?', [
      now.toISOString(),
      req.user.id,
    ]);

    res.json({
      success: true,
      filename,
      filePath,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al guardar copia de seguridad' });
  }
});

// Manejo de rutas API no encontradas
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: 'Ruta API no encontrada' });
});

// Servir frontend en producción
const DIST_DIR = path.join(__dirname, '../dist');
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('*', (req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`🩺 Servidor Centralizado Multi-Usuario (SQLite + 2FA TOTP)`);
  console.log(`🌐 Acceso Local: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
