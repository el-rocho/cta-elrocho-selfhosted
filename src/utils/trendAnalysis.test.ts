import { describe, expect, it } from 'vitest';
import type {
  AppSettings,
  BloodPressureReading,
  BloodPressureSession,
  GuidelineProfile,
} from '../types/bloodPressure';
import { DEFAULT_SETTINGS } from '../services/storageService';
import { processReadingsIntoSessions } from './whiteCoatAlgorithm';
import {
  analyzeBloodPressureTrends,
  buildDailyAverages,
  buildDailyTrendSeries,
  MIN_TREND_DAYS,
  MIN_TREND_SESSIONS,
} from './trendAnalysis';

function session(
  day: number,
  hour: number,
  systolic: number,
  diastolic: number
): BloodPressureSession {
  const timestamp = new Date(2026, 6, day, hour).toISOString();
  return {
    id: `session-${day}-${hour}`,
    timestamp,
    readings: [],
    averageSystolic: systolic,
    averageDiastolic: diastolic,
    averageHeartRate: 70,
    discardedCount: 0,
    arm: 'left',
  };
}

function repeatedSessions(systolic: number, diastolic: number): BloodPressureSession[] {
  return [
    session(1, 8, systolic, diastolic),
    session(1, 20, systolic, diastolic),
    session(2, 8, systolic, diastolic),
    session(2, 20, systolic, diastolic),
    session(3, 8, systolic, diastolic),
    session(3, 20, systolic, diastolic),
  ];
}

function reading(
  day: number,
  minute: number,
  systolic: number,
  diastolic: number
): BloodPressureReading {
  return {
    id: `reading-${day}-${minute}`,
    timestamp: new Date(2026, 6, day, 9, minute).toISOString(),
    systolic,
    diastolic,
    heartRate: 70,
    arm: 'left',
    takesAntihypertensiveMedication: false,
  };
}

function settings(): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    enableWhiteCoatFilter: true,
    whiteCoatIntervalMinutes: 5,
  };
}

describe('trend data sufficiency', () => {
  it('requires enough effective sessions and distinct days', () => {
    const tooFewDays = Array.from({ length: MIN_TREND_SESSIONS }, (_, index) =>
      session(1, index, 145, 90)
    );
    const analysis = analyzeBloodPressureTrends(tooFewDays, 'esc-2024');

    expect(analysis.status).toBe('insufficient');
    expect(analysis.sessionsUsed).toBe(MIN_TREND_SESSIONS);
    expect(analysis.daysUsed).toBe(1);
    expect(analysis.requiredDays).toBe(MIN_TREND_DAYS);
  });

  it('supports a stable weekly measurement cadence across four weeks', () => {
    const sessions = [
      session(1, 8, 128, 78),
      session(8, 8, 130, 80),
      session(15, 8, 134, 82),
      session(22, 8, 136, 84),
    ];
    const analysis = analyzeBloodPressureTrends(sessions, 'esc-2024');

    expect(analysis.status).toBe('ready');
    expect(analysis.daysUsed).toBe(4);
    expect(analysis.comparison).toMatchObject({
      coverage: 'supported',
      firstDays: 2,
      lastDays: 2,
      firstAverageSystolic: 129,
      lastAverageSystolic: 135,
      systolicDifference: 6,
    });
  });

  it('provides an explicitly sparse comparison for readings every ten days', () => {
    const sessions = [
      session(1, 8, 128, 78),
      session(11, 8, 132, 80),
      session(21, 8, 136, 82),
    ];
    const analysis = analyzeBloodPressureTrends(sessions, 'esc-2024');

    expect(analysis.status).toBe('ready');
    expect(analysis.comparison).toMatchObject({
      coverage: 'sparse',
      firstDays: 1,
      lastDays: 2,
    });
  });

  it('does not turn one isolated high day into a repeated pattern', () => {
    const sessions = repeatedSessions(120, 75);
    sessions[0] = session(1, 8, 180, 100);
    const analysis = analyzeBloodPressureTrends(sessions, 'esc-2024');

    expect(analysis.status).toBe('ready');
    expect(analysis.insights).toHaveLength(0);
  });
});

describe('persistent threshold patterns', () => {
  it.each([
    ['esc-2024', 140, 90],
    ['aha-acc-2025', 132, 82],
    ['ish-2020', 140, 90],
  ] as const)('detects repeated values for %s', (profile, systolic, diastolic) => {
    const analysis = analyzeBloodPressureTrends(
      repeatedSessions(systolic, diastolic),
      profile
    );

    expect(analysis.insights.map((insight) => insight.key)).toContain(
      'repeatedAboveThreshold'
    );
    expect(analysis.insights[0].matchingDays).toBe(3);
  });

  it('recalculates the pattern when the selected guideline changes', () => {
    const sessions = repeatedSessions(132, 82);
    const esc = analyzeBloodPressureTrends(sessions, 'esc-2024');
    const aha = analyzeBloodPressureTrends(sessions, 'aha-acc-2025');

    expect(esc.insights).toHaveLength(0);
    expect(aha.insights.map((insight) => insight.key)).toContain(
      'repeatedAboveThreshold'
    );
  });

  it('detects repeated low daily averages independently of the guideline', () => {
    const profiles: GuidelineProfile[] = ['esc-2024', 'aha-acc-2025', 'ish-2020'];
    profiles.forEach((profile) => {
      const analysis = analyzeBloodPressureTrends(repeatedSessions(88, 58), profile);
      expect(analysis.insights.map((insight) => insight.key)).toContain('repeatedLow');
    });
  });
});

describe('white-coat preprocessing and daily weighting', () => {
  it('plots the effective value for a two-reading white-coat episode', () => {
    const { sessions } = processReadingsIntoSessions(
      [reading(1, 0, 124, 82), reading(1, 1, 96, 70)],
      settings()
    );

    expect(buildDailyAverages(sessions)).toMatchObject([
      {
        averageSystolic: 96,
        averageDiastolic: 70,
        sessionCount: 1,
      },
    ]);
  });

  it('uses the effective episode result instead of discarded initial readings', () => {
    const rawReadings = [1, 2, 3].flatMap((day) => [
      reading(day, 0, 170, 100),
      reading(day, 1, 160, 95),
      reading(day, 2, 150, 90),
      reading(day, 3, 125, 78),
      reading(day, 10, 170, 100),
      reading(day, 11, 160, 95),
      reading(day, 12, 150, 90),
      reading(day, 13, 125, 78),
    ]);
    const { sessions } = processReadingsIntoSessions(rawReadings, settings());
    const analysis = analyzeBloodPressureTrends(sessions, 'esc-2024');

    expect(sessions).toHaveLength(6);
    expect(sessions.every((item) => item.averageSystolic === 125)).toBe(true);
    expect(analysis.status).toBe('ready');
    expect(analysis.insights).toHaveLength(0);
  });

  it('weights each day equally even when one day contains more sessions', () => {
    const sessions = [
      session(1, 7, 160, 95),
      session(1, 8, 160, 95),
      session(1, 9, 160, 95),
      session(1, 10, 160, 95),
      session(2, 8, 120, 75),
      session(3, 8, 120, 75),
    ];
    const analysis = analyzeBloodPressureTrends(sessions, 'esc-2024');

    expect(analysis.status).toBe('ready');
    expect(analysis.insights).toHaveLength(0);
    expect(analysis.averageSystolic).toBe(133);
  });

  it('keeps daily averages as the source for every long-term range', () => {
    const sessions = [
      session(1, 8, 120, 75),
      session(1, 20, 140, 85),
      session(8, 8, 130, 80),
      session(15, 8, 135, 82),
    ];

    const daily = buildDailyAverages(sessions);
    const threeMonths = buildDailyTrendSeries(sessions, '3months');
    const oneYear = buildDailyTrendSeries(sessions, '1year');

    expect(daily).toHaveLength(3);
    expect(daily[0]).toMatchObject({
      sessionCount: 2,
      averageSystolic: 130,
      averageDiastolic: 80,
    });
    expect(threeMonths.dailyAverages).toEqual(daily);
    expect(oneYear.dailyAverages).toEqual(daily);
  });
});
