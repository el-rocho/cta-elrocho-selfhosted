import type { AppSettings, BloodPressureReading } from '../types/bloodPressure';
import { DEFAULT_SETTINGS } from '../services/storageService';
import { getReadingValidationError } from './readingValidation';

export const BACKUP_FORMAT = 'cta-elrocho-backup';
export const BACKUP_VERSION = 1;

export interface AppBackupSnapshot {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  createdAt: string;
  readings: BloodPressureReading[];
  settings: AppSettings;
}
export type BackupParseResult =
  | { status: 'valid'; snapshot: AppBackupSnapshot }
  | { status: 'not-backup' }
  | { status: 'invalid'; reason: 'unsupported-version' | 'invalid-content' };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidReading(value: unknown): value is BloodPressureReading {
  if (!isObject(value)) return false;
  const timestamp = typeof value.timestamp === 'string' ? value.timestamp : '';
  if (
    typeof value.systolic !== 'number' ||
    typeof value.diastolic !== 'number' ||
    typeof value.heartRate !== 'number'
  ) return false;

  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    timestamp.length > 0 &&
    Number.isFinite(new Date(timestamp).getTime()) &&
    (value.arm === 'left' || value.arm === 'right') &&
    !getReadingValidationError({
      systolic: value.systolic,
      diastolic: value.diastolic,
      heartRate: value.heartRate,
    }) &&
    (value.notes === undefined || typeof value.notes === 'string') &&
    (value.sessionId === undefined || typeof value.sessionId === 'string') &&
    (value.pulsePressureWarningConfirmed === undefined || typeof value.pulsePressureWarningConfirmed === 'boolean') &&
    (value.takesAntihypertensiveMedication === undefined || typeof value.takesAntihypertensiveMedication === 'boolean')
  );
}

function normalizeSettings(value: unknown): AppSettings | null {
  if (!isObject(value)) return null;
  const candidate = { ...DEFAULT_SETTINGS, ...value } as AppSettings;

  if (candidate.language !== 'es' && candidate.language !== 'en') return null;
  if (typeof candidate.enableWhiteCoatFilter !== 'boolean') return null;
  candidate.whiteCoatIntervalMinutes = 5;
  if (candidate.defaultArm !== 'left' && candidate.defaultArm !== 'right') return null;
  if (candidate.preferredInputMode !== 'keyboard' && candidate.preferredInputMode !== 'wheel') return null;
  if (!['esc-2024', 'aha-acc-2025', 'ish-2020'].includes(candidate.guidelineProfile)) return null;
  if (candidate.treatmentTargetMode !== 'guideline' && candidate.treatmentTargetMode !== 'custom') return null;
  if (![candidate.customTargetSystolicMin, candidate.customTargetSystolicMax, candidate.customTargetDiastolicMin, candidate.customTargetDiastolicMax].every(Number.isFinite)) return null;
  if (candidate.patientName !== undefined && typeof candidate.patientName !== 'string') return null;
  if (candidate.patientSex !== undefined && !['', 'masculino', 'femenino'].includes(candidate.patientSex)) return null;
  if (candidate.patientAge !== undefined && candidate.patientAge !== '' && !Number.isFinite(candidate.patientAge)) return null;
  if (candidate.patientBirthDate !== undefined && typeof candidate.patientBirthDate !== 'string') return null;
  if (!['disabled', 'daily', 'weekly', 'monthly'].includes(candidate.backupFrequency)) return null;
  if (typeof candidate.backupFolder !== 'string') return null;
  if (candidate.lastBackupTimestamp !== undefined && !Number.isFinite(new Date(candidate.lastBackupTimestamp).getTime())) return null;
  if (candidate.lastFullBackupTimestamp !== undefined && !Number.isFinite(new Date(candidate.lastFullBackupTimestamp).getTime())) return null;
  if (typeof candidate.takesAntihypertensiveMedication !== 'boolean') return null;

  return candidate;
}

export function createBackupSnapshot(
  readings: BloodPressureReading[],
  settings: AppSettings,
  createdAt = new Date().toISOString()
): AppBackupSnapshot {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt,
    readings,
    settings,
  };
}

export function serializeBackup(snapshot: AppBackupSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}

export function parseBackupContent(content: string): BackupParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content.replace(/^\uFEFF/, ''));
  } catch {
    return { status: 'not-backup' };
  }

  if (!isObject(parsed) || parsed.format !== BACKUP_FORMAT) {
    return { status: 'not-backup' };
  }
  if (parsed.version !== BACKUP_VERSION) {
    return { status: 'invalid', reason: 'unsupported-version' };
  }
  if (
    typeof parsed.createdAt !== 'string' ||
    !Number.isFinite(new Date(parsed.createdAt).getTime()) ||
    !Array.isArray(parsed.readings) ||
    !parsed.readings.every(isValidReading) ||
    new Set(parsed.readings.map((reading) => reading.id)).size !== parsed.readings.length
  ) {
    return { status: 'invalid', reason: 'invalid-content' };
  }

  const settings = normalizeSettings(parsed.settings);
  if (!settings) return { status: 'invalid', reason: 'invalid-content' };

  return {
    status: 'valid',
    snapshot: {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      createdAt: parsed.createdAt,
      readings: parsed.readings,
      settings,
    },
  };
}

function formatFilenameTimestamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

export function downloadBackup(
  readings: BloodPressureReading[],
  settings: AppSettings,
  now = new Date()
): string {
  const snapshot = createBackupSnapshot(readings, settings, now.toISOString());
  const filename = `control_tension_backup_${formatFilenameTimestamp(now)}.cta-backup.json`;
  const blob = new Blob([serializeBackup(snapshot)], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return filename;
}
