import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../services/storageService';
import type { BloodPressureSession } from '../types/bloodPressure';
import { buildDailyTrendSeries, type LongTermTrendRange } from './trendAnalysis';
import { calculatePeriodSummary, summarizeMeasurements } from './summaryStatistics';
import { calculateCardiovascularMetrics, calculateEstimatedMeanArterialPressure } from './cardiovascularMetrics';

function session(
  id: string,
  systolic: number,
  diastolic: number,
  heartRate: number
): BloodPressureSession {
  const timestamp = `2026-07-${String(Number(id) + 10).padStart(2, '0')}T08:00:00.000Z`;
  return {
    id,
    timestamp,
    readings: [{
      id: `reading-${id}`,
      timestamp,
      systolic,
      diastolic,
      heartRate,
      arm: 'left',
      takesAntihypertensiveMedication: true,
    }],
    averageSystolic: systolic,
    averageDiastolic: diastolic,
    averageHeartRate: heartRate,
    discardedCount: 0,
    arm: 'left',
  };
}

function datedSession(
  id: string,
  timestamp: string,
  systolic: number,
  diastolic: number
): BloodPressureSession {
  return {
    id,
    timestamp,
    readings: [{
      id: `reading-${id}`,
      timestamp,
      systolic,
      diastolic,
      heartRate: 70,
      arm: 'left',
      takesAntihypertensiveMedication: true,
    }],
    averageSystolic: systolic,
    averageDiastolic: diastolic,
    averageHeartRate: 70,
    discardedCount: 0,
    arm: 'left',
  };
}

describe('summary statistics', () => {
  it('calculates estimated MAP from systolic and diastolic pressure', () => {
    expect(calculateEstimatedMeanArterialPressure(120, 75)).toBe(90);
    expect(calculateEstimatedMeanArterialPressure(135, 85)).toBe(102);
  });

  it('calculates mean pulse pressure across the effective sessions', () => {
    const metrics = calculateCardiovascularMetrics([
      session('1', 120, 80, 70),
      session('2', 141, 80, 70),
      session('3', 130, 75, 70),
    ]);

    expect(metrics.pulsePressure).toEqual({ average: 52 });
    expect(calculateCardiovascularMetrics([]).pulsePressure.average).toBe(0);
  });

  it('calculates home pressure load with inclusive systolic-or-diastolic thresholds', () => {
    const metrics = calculateCardiovascularMetrics([
      session('1', 134, 84, 70), session('2', 135, 84, 70),
      session('3', 134, 85, 70), session('4', 135, 85, 70),
      session('5', 120, 75, 70), session('6', 140, 90, 70),
    ]);
    expect(metrics.pressureLoad).toMatchObject({
      totalSessions: 6, elevatedSessions: 4,
      elevatedSystolicSessions: 3, elevatedDiastolicSessions: 3,
      elevatedPercentage: 67, systolicPercentage: 50, diastolicPercentage: 50,
      hasSufficientData: true,
    });
  });

  it('calculates average, extremes and interpolated P90/P10 values', () => {
    expect(summarizeMeasurements([100, 110, 120, 130, 140])).toEqual({
      average: 120,
      maximum: 140,
      minimum: 100,
      percentile90: 136,
      percentile10: 104,
    });
  });

  it('calculates category and treatment-target modes for the selected period', () => {
    const sessions = [
      session('1', 120, 75, 70),
      session('2', 130, 80, 72),
      session('3', 140, 90, 74),
      session('4', 150, 95, 76),
      session('5', 160, 100, 78),
    ];
    const summary = calculatePeriodSummary(sessions, {
      ...DEFAULT_SETTINGS,
      takesAntihypertensiveMedication: true,
    });

    expect(summary.systolic.average).toBe(140);
    expect(summary.categoryMode).toEqual({ status: 'unique', value: 'hypertension' });
    expect(summary.targetMode.status).toBe('unique');
    expect(summary.targetMode.value?.status).toBe('above');
  });

  it('changes both global-status modes when the selected range changes their predominant values', () => {
    const sessions = [
      datedSession('recent-1', '2026-07-28T08:00:00.000Z', 122, 76),
      datedSession('recent-2', '2026-07-27T08:00:00.000Z', 124, 78),
      datedSession('old-1', '2026-05-20T08:00:00.000Z', 145, 92),
      datedSession('old-2', '2026-05-19T08:00:00.000Z', 148, 94),
      datedSession('old-3', '2026-05-18T08:00:00.000Z', 150, 96),
    ];
    const settings = {
      ...DEFAULT_SETTINGS,
      takesAntihypertensiveMedication: true,
    };
    const summarizeRange = (range: LongTermTrendRange) => {
      const periodSessions = buildDailyTrendSeries(sessions, range)
        .dailyAverages.flatMap((day) => day.sessions);
      return calculatePeriodSummary(periodSessions, settings);
    };

    const oneMonth = summarizeRange('1month');
    const threeMonths = summarizeRange('3months');

    expect(oneMonth.categoryMode.value).toBe('elevated');
    expect(oneMonth.targetMode.value?.status).toBe('within');
    expect(threeMonths.categoryMode.value).toBe('hypertension');
    expect(threeMonths.targetMode.value?.status).toBe('above');
  });
});
