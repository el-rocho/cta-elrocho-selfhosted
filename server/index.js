import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { getDB, DATA_DIR, BACKUPS_DIR } from './db.js';
import {
  hashPassword,
  comparePassword,
  createSession,
  destroySession,
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

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));

// Tokens temporales para flujo 2FA durante el login (validez 5 minutos)
const pendingTotpLogins = new Map();

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

    const sessionId = req.cookies?.[SESSION_COOKIE_NAME];
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
  const sessionId = req.cookies?.[SESSION_COOKIE_NAME];
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
    await db.run('UPDATE users SET totp_secret = ? WHERE id = ?', [secret, req.user.id]);
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
    const user = await db.get('SELECT totp_secret FROM users WHERE id = ?', [req.user.id]);

    if (!user || !user.totp_secret) {
      return res.status(400).json({ error: 'Inicia la configuración de 2FA primero.' });
    }

    const isValid = verifyTotpToken(code, user.totp_secret);
    if (!isValid) {
      return res.status(400).json({ error: 'Código incorrecto. Verifica la hora de tu teléfono.' });
    }

    const recoveryCodes = generateRecoveryCodes(8);

    await db.run(
      'UPDATE users SET totp_enabled = 1, recovery_codes_json = ? WHERE id = ?',
      [JSON.stringify(recoveryCodes), req.user.id]
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
      'UPDATE users SET totp_enabled = 0, totp_secret = NULL, recovery_codes_json = NULL WHERE id = ?',
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
      'SELECT id, timestamp, systolic, diastolic, heart_rate as heartRate, arm, notes FROM readings WHERE user_id = ? ORDER BY timestamp DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener mediciones' });
  }
});

app.post('/api/readings', requireAuth, async (req, res) => {
  try {
    const { systolic, diastolic, heartRate, arm, notes } = req.body;
    if (!systolic || !diastolic || !heartRate) {
      return res.status(400).json({ error: 'Faltan parámetros obligatorios' });
    }

    const db = await getDB();
    const newReading = {
      id: `bp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      user_id: req.user.id,
      timestamp: new Date().toISOString(),
      systolic: Number(systolic),
      diastolic: Number(diastolic),
      heartRate: Number(heartRate),
      arm: arm || 'left',
      notes: notes ? String(notes).trim() : null,
      created_at: new Date().toISOString(),
    };

    await db.run(
      'INSERT INTO readings (id, user_id, timestamp, systolic, diastolic, heart_rate, arm, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        newReading.id,
        newReading.user_id,
        newReading.timestamp,
        newReading.systolic,
        newReading.diastolic,
        newReading.heartRate,
        newReading.arm,
        newReading.notes,
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
    });
  } catch (error) {
    console.error('Error al guardar medición:', error);
    res.status(500).json({ error: 'Error al guardar la medición' });
  }
});

app.put('/api/readings/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { systolic, diastolic, heartRate, notes } = req.body;
    const db = await getDB();

    const existing = await db.get('SELECT * FROM readings WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Toma no encontrada' });
    }

    const sysNum = Number(systolic);
    const diaNum = Number(diastolic);
    const hrNum = Number(heartRate);
    const cleanNotes = notes ? String(notes).trim() : null;

    await db.run(
      'UPDATE readings SET systolic = ?, diastolic = ?, heart_rate = ?, notes = ? WHERE id = ? AND user_id = ?',
      [sysNum, diaNum, hrNum, cleanNotes, id, req.user.id]
    );

    res.json({
      ...existing,
      systolic: sysNum,
      diastolic: diaNum,
      heartRate: hrNum,
      notes: cleanNotes || undefined,
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

app.post('/api/readings/import', requireAuth, async (req, res) => {
  try {
    const importedItems = req.body;
    if (!Array.isArray(importedItems)) {
      return res.status(400).json({ error: 'Formato inválido para importación' });
    }

    const db = await getDB();
    const current = await db.all('SELECT * FROM readings WHERE user_id = ?', [req.user.id]);
    const existingSigs = new Set(
      current.map((r) => `${new Date(r.timestamp).toISOString().slice(0, 16)}_${r.systolic}_${r.diastolic}_${r.heart_rate}`)
    );

    let addedCount = 0;
    const now = new Date().toISOString();

    for (const item of importedItems) {
      const sig = `${new Date(item.timestamp).toISOString().slice(0, 16)}_${item.systolic}_${item.diastolic}_${item.heartRate}`;
      if (!existingSigs.has(sig)) {
        existingSigs.add(sig);
        addedCount++;
        const id = `imp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        await db.run(
          'INSERT INTO readings (id, user_id, timestamp, systolic, diastolic, heart_rate, arm, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            id,
            req.user.id,
            item.timestamp,
            Number(item.systolic),
            Number(item.diastolic),
            Number(item.heartRate),
            item.arm || 'left',
            item.notes ? String(item.notes).trim() : null,
            now,
          ]
        );
      }
    }

    const updatedRows = await db.all(
      'SELECT id, timestamp, systolic, diastolic, heart_rate as heartRate, arm, notes FROM readings WHERE user_id = ? ORDER BY timestamp DESC',
      [req.user.id]
    );

    res.json({ addedCount, total: updatedRows.length, readings: updatedRows });
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
      whiteCoatIntervalMinutes: row?.white_coat_minutes || 5,
      defaultArm: row?.default_arm || 'left',
      preferredInputMode: row?.preferred_input_mode || 'keyboard',
      patientName: row?.patient_name || req.user.name || '',
      patientSex: row?.patient_sex || req.user.sex || '',
      patientAge: row?.patient_age || '',
      patientBirthDate: row?.patient_birth_date || req.user.birth_date || '',
      backupFrequency: row?.backup_frequency || 'disabled',
      backupFolder: row?.backup_folder || 'Descargas/Copias_Tension_Arterial',
      lastBackupTimestamp: row?.last_backup_timestamp || undefined,
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
        patient_name, patient_sex, patient_age, patient_birth_date, backup_frequency, backup_folder, last_backup_timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        language = excluded.language,
        enable_white_coat = excluded.enable_white_coat,
        white_coat_minutes = excluded.white_coat_minutes,
        default_arm = excluded.default_arm,
        preferred_input_mode = excluded.preferred_input_mode,
        patient_name = excluded.patient_name,
        patient_sex = excluded.patient_sex,
        patient_age = excluded.patient_age,
        patient_birth_date = excluded.patient_birth_date,
        backup_frequency = excluded.backup_frequency,
        backup_folder = excluded.backup_folder,
        last_backup_timestamp = excluded.last_backup_timestamp;`,
      [
        req.user.id,
        s.language || 'es',
        s.enableWhiteCoatFilter ? 1 : 0,
        s.whiteCoatIntervalMinutes || 5,
        s.defaultArm || 'left',
        s.preferredInputMode || 'keyboard',
        s.patientName || req.user.name || '',
        s.patientSex || req.user.sex || '',
        s.patientAge || '',
        s.patientBirthDate || req.user.birth_date || '',
        s.backupFrequency || 'disabled',
        s.backupFolder || 'Descargas/Copias_Tension_Arterial',
        s.lastBackupTimestamp || null,
      ]
    );

    // Mantener sincronizada la tabla users si se cambia el nombre, género o fecha de nacimiento
    if (s.patientName || s.patientSex || s.patientBirthDate) {
      await db.run(
        'UPDATE users SET name = COALESCE(?, name), sex = COALESCE(?, sex), birth_date = COALESCE(?, birth_date) WHERE id = ?',
        [s.patientName || null, s.patientSex || null, s.patientBirthDate || null, req.user.id]
      );
    }

    res.json({ success: true, settings: s });
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
