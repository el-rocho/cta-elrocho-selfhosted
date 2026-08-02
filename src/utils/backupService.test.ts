import { describe, expect, it } from 'vitest';
import type { AppSettings, BloodPressureReading, BloodPressureSession } from '../types/bloodPressure';
import { DEFAULT_SETTINGS } from '../services/storageService';
import {
  BACKUP_FORMAT,
  createBackupSnapshot,
  parseBackupContent,
  serializeBackup,
} from './backupService';
import { buildCSVContent } from './exportCsv';
import { analyzeCSVImport } from './importCsv';

const settings: AppSettings = {
  ...DEFAULT_SETTINGS,
  patientName: 'Paciente de prueba',
  patientBirthDate: '1960-04-12',
  patientAge: 66,
  enableWhiteCoatFilter: true,
  backupFrequency: 'weekly',
};

const readings: BloodPressureReading[] = [
  {
    id: 'reading-1',
    sessionId: 'session-1',
    timestamp: '2026-07-30T08:00:00.000Z',
    systolic: 145,
    diastolic: 88,
    heartRate: 72,
    arm: 'left',
    notes: 'Primera toma',
    takesAntihypertensiveMedication: true,
  },
  {
    id: 'reading-2',
    sessionId: 'session-1',
    timestamp: '2026-07-30T08:03:00.000Z',
    systolic: 132,
    diastolic: 82,
    heartRate: 69,
    arm: 'left',
    pulsePressureWarningConfirmed: false,
    takesAntihypertensiveMedication: true,
  },
];

describe('complete application backups', () => {
  it('round-trips every original reading, session id and setting', () => {
    const snapshot = createBackupSnapshot(readings, settings, '2026-07-31T12:00:00.000Z');
    const result = parseBackupContent(serializeBackup(snapshot));

    expect(result.status).toBe('valid');
    if (result.status !== 'valid') return;
    expect(result.snapshot).toEqual(snapshot);
    expect(result.snapshot.readings).toHaveLength(2);
    expect(result.snapshot.readings.map((reading) => reading.sessionId)).toEqual(['session-1', 'session-1']);
  });

  it('normalizes configurable intervals from legacy backups to five minutes', () => {
    const snapshot = createBackupSnapshot(readings, settings, '2026-07-31T12:00:00.000Z');
    const legacySnapshot = {
      ...snapshot,
      settings: { ...snapshot.settings, whiteCoatIntervalMinutes: 3 },
    };
    const result = parseBackupContent(JSON.stringify(legacySnapshot));

    expect(result.status).toBe('valid');
    if (result.status !== 'valid') return;
    expect(result.snapshot.settings.whiteCoatIntervalMinutes).toBe(5);
  });

  it('rejects unsupported and incomplete native backups without treating them as CSV', () => {
    expect(parseBackupContent(JSON.stringify({ format: BACKUP_FORMAT, version: 99 }))).toEqual({
      status: 'invalid',
      reason: 'unsupported-version',
    });
    expect(parseBackupContent(JSON.stringify({ format: BACKUP_FORMAT, version: 1 }))).toEqual({
      status: 'invalid',
      reason: 'invalid-content',
    });
  });

  it('keeps accepting CSV files produced by previous versions', () => {
    const session: BloodPressureSession = {
      id: 'legacy-session',
      timestamp: '2026-07-30T08:00:00.000Z',
      readings,
      averageSystolic: 132,
      averageDiastolic: 82,
      averageHeartRate: 69,
      discardedCount: 1,
      arm: 'left',
      notes: 'Sesión antigua',
    };
    const legacyCsv = buildCSVContent([session], { preset: 'all' }, settings, 'es');
    const result = analyzeCSVImport(legacyCsv);

    expect(result.format).toBe('native');
    expect(result.readings).toHaveLength(1);
    expect(result.readings[0]).toMatchObject({ systolic: 132, diastolic: 82, heartRate: 69, arm: 'left' });
  });
});
