import { describe, expect, it } from 'vitest';
import type { BloodPressureReading } from '../types/bloodPressure';
import { DEFAULT_SETTINGS } from '../services/storageService';
import { isBackupDue } from './backupScheduler';

const reading: BloodPressureReading = {
  id: 'reading-1',
  timestamp: '2026-07-01T08:00:00.000Z',
  systolic: 120,
  diastolic: 75,
  heartRate: 70,
  arm: 'left',
};

describe('backup reminders', () => {
  it('does not schedule downloads when reminders are disabled or there is no data', () => {
    expect(isBackupDue([reading], DEFAULT_SETTINGS, new Date('2026-07-31T12:00:00.000Z'))).toBe(false);
    expect(isBackupDue([], { ...DEFAULT_SETTINGS, backupFrequency: 'daily' }, new Date('2026-07-31T12:00:00.000Z'))).toBe(false);
  });

  it('requests the first backup as soon as a reminder is enabled', () => {
    expect(isBackupDue([reading], { ...DEFAULT_SETTINGS, backupFrequency: 'weekly' }, new Date('2026-07-31T12:00:00.000Z'))).toBe(true);
    expect(isBackupDue([reading], {
      ...DEFAULT_SETTINGS,
      backupFrequency: 'weekly',
      lastBackupTimestamp: '2026-07-30T12:00:00.000Z',
    }, new Date('2026-07-31T12:00:00.000Z'))).toBe(true);
  });

  it('respects daily, weekly and monthly elapsed periods', () => {
    const now = new Date('2026-07-31T12:00:00.000Z');
    expect(isBackupDue([reading], { ...DEFAULT_SETTINGS, backupFrequency: 'daily', lastFullBackupTimestamp: '2026-07-30T18:00:00.000Z' }, now)).toBe(true);
    expect(isBackupDue([reading], { ...DEFAULT_SETTINGS, backupFrequency: 'weekly', lastFullBackupTimestamp: '2026-07-25T12:01:00.000Z' }, now)).toBe(false);
    expect(isBackupDue([reading], { ...DEFAULT_SETTINGS, backupFrequency: 'monthly', lastFullBackupTimestamp: '2026-07-01T12:00:00.000Z' }, now)).toBe(true);
  });
});
