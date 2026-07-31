import { describe, expect, it } from 'vitest';
import type { AppSettings, BloodPressureReading } from '../types/bloodPressure';
import { DEFAULT_SETTINGS } from '../services/storageService';
import {
  getEffectiveSessionReadings,
  getSessionSummaryReading,
  processReadingsIntoSessions,
} from './whiteCoatAlgorithm';

function reading(
  index: number,
  systolic: number,
  diastolic: number,
  heartRate = 70
): BloodPressureReading {
  return {
    id: `reading-${index}`,
    timestamp: new Date(2026, 6, 30, 9, index).toISOString(),
    systolic,
    diastolic,
    heartRate,
    arm: 'left',
    takesAntihypertensiveMedication: false,
  };
}

function settings(enableWhiteCoatFilter: boolean): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    enableWhiteCoatFilter,
    whiteCoatIntervalMinutes: 5,
  };
}

describe('initial sensitivity filter', () => {
  const descendingReadings = [
    reading(0, 170, 100),
    reading(1, 160, 95),
    reading(2, 150, 90),
    reading(3, 130, 80),
  ];

  it('preprocesses a sensitive episode into one effective measurement', () => {
    const { sessions, allReadings } = processReadingsIntoSessions(
      descendingReadings,
      settings(true)
    );

    expect(sessions).toHaveLength(1);
    expect(sessions[0].readings).toHaveLength(4);
    expect(sessions[0].discardedCount).toBe(3);
    expect(sessions[0].averageSystolic).toBe(130);
    expect(sessions[0].averageDiastolic).toBe(80);
    expect(allReadings).toHaveLength(4);
  });

  it('does not group readings when the optional filter is disabled', () => {
    const { sessions } = processReadingsIntoSessions(descendingReadings, settings(false));
    expect(sessions).toHaveLength(4);
    expect(sessions.every((session) => session.readings.length === 1)).toBe(true);
  });

  it('keeps stable repeated readings in the effective average', () => {
    const stableReadings = [
      reading(0, 140, 85),
      reading(1, 138, 84),
      reading(2, 137, 83),
      reading(3, 136, 82),
    ];
    const { sessions } = processReadingsIntoSessions(stableReadings, settings(true));

    expect(sessions).toHaveLength(1);
    expect(sessions[0].discardedCount).toBe(0);
    expect(sessions[0].averageSystolic).toBe(138);
    expect(sessions[0].averageDiastolic).toBe(84);
  });

  it('exposes only the effective result after discarding the initial peak', () => {
    const { sessions } = processReadingsIntoSessions(
      [reading(0, 124, 82, 68), reading(1, 96, 70, 60)],
      settings(true)
    );

    expect(sessions).toHaveLength(1);
    expect(sessions[0].discardedCount).toBe(1);
    expect(getEffectiveSessionReadings(sessions[0]).map((item) => item.id)).toEqual([
      'reading-1',
    ]);
    expect(getSessionSummaryReading(sessions[0])).toMatchObject({
      systolic: 96,
      diastolic: 70,
      heartRate: 60,
    });
  });
});
