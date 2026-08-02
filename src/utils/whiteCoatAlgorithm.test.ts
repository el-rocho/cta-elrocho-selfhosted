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

  it('groups readings up to five minutes apart and splits them above that limit', () => {
    const input = [reading(0, 140, 85), reading(5, 138, 84), reading(11, 136, 82)];
    const { sessions } = processReadingsIntoSessions(input, settings(true));

    expect(sessions.map((session) => session.readings.length).sort((a, b) => a - b)).toEqual([1, 2]);
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

  it('does not mutate the input readings or reuse their object references', () => {
    const input = [reading(0, 150, 90), reading(1, 130, 80)];
    const snapshot = input.map((item) => ({ ...item }));

    const { sessions, allReadings } = processReadingsIntoSessions(input, settings(true));

    expect(input).toEqual(snapshot);
    expect(input.every((item) => item.sessionId === undefined)).toBe(true);
    expect(allReadings[0]).not.toBe(input[0]);
    expect(sessions[0].readings[0]).not.toBe(input[0]);
    expect(sessions[0].readings.every((item) => item.sessionId === sessions[0].id)).toBe(true);
  });

  it('ignores legacy interval settings and regroups stale ids with the fixed five-minute window', () => {
    const input = [
      { ...reading(0, 140, 85), sessionId: 'stale-shared-session' },
      { ...reading(4, 138, 84), sessionId: 'stale-shared-session' },
      { ...reading(8, 136, 82), sessionId: 'stale-shared-session' },
    ];
    const legacySettings = { ...settings(true), whiteCoatIntervalMinutes: 3 } as unknown as AppSettings;

    const { sessions } = processReadingsIntoSessions(input, legacySettings);
    const ids = sessions.map((session) => session.id);

    expect(sessions).toHaveLength(1);
    expect(new Set(ids).size).toBe(1);
    expect(ids).not.toContain('stale-shared-session');
    expect(input.every((item) => item.sessionId === 'stale-shared-session')).toBe(true);
  });
});
