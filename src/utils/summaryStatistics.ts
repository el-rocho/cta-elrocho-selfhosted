import type {
  AppSettings,
  BloodPressureSession,
  HealthSeverity,
} from '../types/bloodPressure';
import {
  getHealthCategory,
  getSessionMedicationContext,
} from './healthClassification';
import {
  analyzeBloodPressureTrends,
  buildDailyTrendSeries,
  type TrendAnalysis,
} from './trendAnalysis';
import {
  assessTreatmentTarget,
  type TreatmentTargetAssessment,
} from './treatmentTarget';
import { calculateCardiovascularMetrics, type CardiovascularMetrics } from './cardiovascularMetrics';

export type ModeStatus = 'none' | 'unique' | 'tie';

export interface ModeResult<T> {
  status: ModeStatus;
  value?: T;
}

export interface MeasurementStatistics {
  average: number;
  maximum: number;
  minimum: number;
  percentile90: number;
  percentile10: number;
}

export interface PeriodSummaryStatistics {
  systolic: MeasurementStatistics;
  diastolic: MeasurementStatistics;
  heartRate: MeasurementStatistics;
  categoryMode: ModeResult<HealthSeverity>;
  targetMode: ModeResult<TreatmentTargetAssessment>;
  cardiovascular: CardiovascularMetrics;
}

export interface TrendCardStatistics {
  analysis: TrendAnalysis;
  targetMode: ModeResult<TreatmentTargetAssessment>;
}

function percentile(values: number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * fraction;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const lowerValue = sorted[lowerIndex];
  const upperValue = sorted[upperIndex];
  const interpolated = lowerValue + (upperValue - lowerValue) * (position - lowerIndex);
  return Math.round(interpolated);
}

export function summarizeMeasurements(values: number[]): MeasurementStatistics {
  if (values.length === 0) {
    return { average: 0, maximum: 0, minimum: 0, percentile90: 0, percentile10: 0 };
  }

  return {
    average: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
    maximum: Math.max(...values),
    minimum: Math.min(...values),
    percentile90: percentile(values, 0.9),
    percentile10: percentile(values, 0.1),
  };
}

function findMode<T>(values: T[], getKey: (value: T) => string): ModeResult<T> {
  if (values.length === 0) return { status: 'none' };

  const counts = new Map<string, number>();
  values.forEach((value) => {
    const key = getKey(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  const highestCount = Math.max(...counts.values());
  const dominantKeys = [...counts.entries()]
    .filter(([, count]) => count === highestCount)
    .map(([key]) => key);

  if (dominantKeys.length !== 1) return { status: 'tie' };
  return {
    status: 'unique',
    value: values.find((value) => getKey(value) === dominantKeys[0]),
  };
}

export function getTargetMode(
  sessions: BloodPressureSession[],
  settings: AppSettings
): ModeResult<TreatmentTargetAssessment> {
  const assessments = sessions
    .filter((session) => getSessionMedicationContext(
      session.readings,
      settings.takesAntihypertensiveMedication
    ))
    .map((session) => assessTreatmentTarget(
      session.averageSystolic,
      session.averageDiastolic,
      settings
    ));

  return findMode(assessments, ({ status }) => status);
}

export function calculatePeriodSummary(
  sessions: BloodPressureSession[],
  settings: AppSettings
): PeriodSummaryStatistics {
  const categoryKeys = sessions.map((session) => getHealthCategory(
    session.averageSystolic,
    session.averageDiastolic,
    'es',
    settings.guidelineProfile
  ).key);

  return {
    systolic: summarizeMeasurements(sessions.map((session) => session.averageSystolic)),
    diastolic: summarizeMeasurements(sessions.map((session) => session.averageDiastolic)),
    heartRate: summarizeMeasurements(sessions.map((session) => session.averageHeartRate)),
    categoryMode: findMode(categoryKeys, (key) => key),
    targetMode: getTargetMode(sessions, settings),
    cardiovascular: calculateCardiovascularMetrics(sessions),
  };
}

export function calculateTrendCardStatistics(
  sessions: BloodPressureSession[],
  settings: AppSettings
): TrendCardStatistics {
  const trendSessions = buildDailyTrendSeries(sessions, '28days').dailyAverages
    .flatMap((day) => day.sessions);

  return {
    analysis: analyzeBloodPressureTrends(sessions, settings.guidelineProfile),
    targetMode: getTargetMode(trendSessions, settings),
  };
}
