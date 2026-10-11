import crypto from 'crypto';

function invalidBackup() {
  const error = new Error('Copia de seguridad no válida');
  error.status = 400;
  return error;
}

function validateSnapshot(snapshot) {
  if (!snapshot || snapshot.format !== 'cta-elrocho-backup' || snapshot.version !== 1 ||
      typeof snapshot.createdAt !== 'string' || !Number.isFinite(Date.parse(snapshot.createdAt)) ||
      !Array.isArray(snapshot.readings) || !snapshot.settings || typeof snapshot.settings !== 'object' ||
      Array.isArray(snapshot.settings)) throw invalidBackup();
  const s = snapshot.settings;
  if (!['es', 'en'].includes(s.language) || typeof s.enableWhiteCoatFilter !== 'boolean' ||
      !['left', 'right'].includes(s.defaultArm) || !['keyboard', 'wheel'].includes(s.preferredInputMode) ||
      !['esc-2024', 'aha-acc-2025', 'ish-2020'].includes(s.guidelineProfile) ||
      typeof s.showInformationalLabels !== 'boolean' ||
      !['guideline', 'custom'].includes(s.treatmentTargetMode) ||
      ![s.customTargetSystolicMin, s.customTargetSystolicMax, s.customTargetDiastolicMin, s.customTargetDiastolicMax].every(Number.isFinite) ||
      typeof s.takesAntihypertensiveMedication !== 'boolean' ||
      !['disabled', 'daily', 'weekly', 'monthly'].includes(s.backupFrequency) ||
      typeof s.backupFolder !== 'string' ||
      (s.patientName != null && typeof s.patientName !== 'string') ||
      (s.patientSex != null && !['', 'masculino', 'femenino'].includes(s.patientSex)) ||
      (s.patientAge != null && s.patientAge !== '' && !Number.isFinite(s.patientAge)) ||
      (s.patientBirthDate != null && typeof s.patientBirthDate !== 'string') ||
      [s.lastBackupTimestamp, s.lastFullBackupTimestamp].some((v) => v != null && (typeof v !== 'string' || !Number.isFinite(Date.parse(v))))) throw invalidBackup();
  for (const r of snapshot.readings) {
    if (!r || typeof r.id !== 'string' || !r.id || typeof r.timestamp !== 'string' ||
        !Number.isFinite(Date.parse(r.timestamp)) ||
        !Number.isInteger(r.systolic) || r.systolic < 50 || r.systolic > 260 ||
        !Number.isInteger(r.diastolic) || r.diastolic < 30 || r.diastolic > 160 ||
        r.diastolic >= r.systolic || !Number.isInteger(r.heartRate) ||
        r.heartRate < 30 || r.heartRate > 220 ||
        !['left', 'right'].includes(r.arm) ||
        (r.notes != null && typeof r.notes !== 'string') ||
        (r.pulsePressureWarningConfirmed != null && typeof r.pulsePressureWarningConfirmed !== 'boolean') ||
        (r.takesAntihypertensiveMedication != null && typeof r.takesAntihypertensiveMedication !== 'boolean')) throw invalidBackup();
  }
  if (new Set(snapshot.readings.map((r) => r.id)).size !== snapshot.readings.length) throw invalidBackup();
}

export async function replaceBackupForUser(db, userId, snapshot) {
  validateSnapshot(snapshot);
  const s = snapshot.settings;
  const now = new Date().toISOString();
  const restoredSettings = {
    ...s,
    lastBackupTimestamp: snapshot.createdAt,
    lastFullBackupTimestamp: snapshot.createdAt,
    whiteCoatIntervalMinutes: 5,
  };
  await db.exec('BEGIN IMMEDIATE');
  try {
    await db.run('DELETE FROM readings WHERE user_id = ?', [userId]);
    for (const r of snapshot.readings) {
      await db.run(
        `INSERT INTO readings (id, user_id, timestamp, systolic, diastolic, heart_rate, arm, notes,
         pulse_pressure_confirmed, takes_antihypertensive_medication, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), userId, r.timestamp, r.systolic, r.diastolic, r.heartRate,
         r.arm, r.notes ?? null, r.pulsePressureWarningConfirmed ? 1 : 0,
         (r.takesAntihypertensiveMedication ?? s.takesAntihypertensiveMedication) ? 1 : 0, now]
      );
    }
    await db.run(
      `INSERT INTO settings (user_id, language, enable_white_coat, white_coat_minutes, default_arm,
       preferred_input_mode, guideline_profile, show_informational_labels, treatment_target_mode,
       custom_target_systolic_min, custom_target_systolic_max, custom_target_diastolic_min,
       custom_target_diastolic_max, patient_name, patient_sex, patient_age, patient_birth_date,
       takes_antihypertensive_medication, backup_frequency, backup_folder, last_backup_timestamp,
       last_full_backup_timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
       language=excluded.language, enable_white_coat=excluded.enable_white_coat,
       white_coat_minutes=excluded.white_coat_minutes, default_arm=excluded.default_arm,
       preferred_input_mode=excluded.preferred_input_mode, guideline_profile=excluded.guideline_profile,
       show_informational_labels=excluded.show_informational_labels, treatment_target_mode=excluded.treatment_target_mode,
       custom_target_systolic_min=excluded.custom_target_systolic_min,
       custom_target_systolic_max=excluded.custom_target_systolic_max,
       custom_target_diastolic_min=excluded.custom_target_diastolic_min,
       custom_target_diastolic_max=excluded.custom_target_diastolic_max,
       patient_name=excluded.patient_name, patient_sex=excluded.patient_sex,
       patient_age=excluded.patient_age, patient_birth_date=excluded.patient_birth_date,
       takes_antihypertensive_medication=excluded.takes_antihypertensive_medication,
       backup_frequency=excluded.backup_frequency, backup_folder=excluded.backup_folder,
       last_backup_timestamp=excluded.last_backup_timestamp,
       last_full_backup_timestamp=excluded.last_full_backup_timestamp`,
      [userId, s.language, s.enableWhiteCoatFilter ? 1 : 0, 5, s.defaultArm,
       s.preferredInputMode, s.guidelineProfile, s.showInformationalLabels ? 1 : 0,
       s.treatmentTargetMode, s.customTargetSystolicMin, s.customTargetSystolicMax,
       s.customTargetDiastolicMin, s.customTargetDiastolicMax, s.patientName || '',
       s.patientSex || '', s.patientAge || '', s.patientBirthDate || '',
       s.takesAntihypertensiveMedication ? 1 : 0, s.backupFrequency,
       s.backupFolder, snapshot.createdAt, snapshot.createdAt]
    );
    await db.run(
      'UPDATE users SET name = ?, sex = ?, birth_date = ? WHERE id = ?',
      [s.patientName ?? '', s.patientSex ?? '', s.patientBirthDate ?? '', userId]
    );
    const rows = await db.all(
      `SELECT id, timestamp, systolic, diastolic, heart_rate AS heartRate, arm, notes,
       pulse_pressure_confirmed AS pulsePressureWarningConfirmed,
       takes_antihypertensive_medication AS takesAntihypertensiveMedication
       FROM readings WHERE user_id = ? ORDER BY timestamp DESC`, [userId]
    );
    await db.exec('COMMIT');
    return {
      readings: rows.map((row) => ({ ...row,
        pulsePressureWarningConfirmed: Boolean(row.pulsePressureWarningConfirmed),
        takesAntihypertensiveMedication: Boolean(row.takesAntihypertensiveMedication),
      })),
      settings: restoredSettings,
    };
  } catch (error) {
    try { await db.exec('ROLLBACK'); } catch (rollbackError) {
      console.error('Error al revertir restauración:', rollbackError);
    }
    throw error;
  }
}
