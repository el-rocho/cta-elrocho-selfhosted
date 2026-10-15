import type { BloodPressureReading } from '../types/bloodPressure';
import { requiresPulsePressureConfirmation } from './healthClassification';

export type ReadingValidationError = 'invalidValues' | 'diastolicNotLower';
export interface ReadingValues { systolic: number; diastolic: number; heartRate: number }
export type ReadingMetric = keyof ReadingValues;

export const READING_LIMITS = {
  systolic: { min: 50, max: 260 },
  diastolic: { min: 30, max: 160 },
  heartRate: { min: 30, max: 220 },
} as const satisfies Record<ReadingMetric, { min: number; max: number }>;

export function isReadingMetricPlausible(metric: ReadingMetric, value: number | ''): value is number {
  if (typeof value !== 'number' || !Number.isInteger(value)) return false;
  const { min, max } = READING_LIMITS[metric];
  return value >= min && value <= max;
}

export function getReadingValidationError(values: ReadingValues): ReadingValidationError | null {
  const { systolic, diastolic, heartRate } = values;
  if (
    !isReadingMetricPlausible('systolic', systolic) ||
    !isReadingMetricPlausible('diastolic', diastolic) ||
    !isReadingMetricPlausible('heartRate', heartRate)
  ) return 'invalidValues';
  if (diastolic >= systolic) return 'diastolicNotLower';
  return null;
}

export function needsPulsePressureConfirmation(values: ReadingValues): boolean {
  return requiresPulsePressureConfirmation(values.systolic, values.diastolic);
}

export function hasSimilarConfirmedReadingToday(
  readings: BloodPressureReading[],
  values: ReadingValues,
  now = new Date(),
  excludedReadingId?: string
): boolean {
  const sameLocalDay = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  };
  return readings.some((reading) =>
    reading.id !== excludedReadingId &&
    reading.pulsePressureWarningConfirmed === true &&
    sameLocalDay(reading.timestamp) &&
    Math.abs(reading.systolic - values.systolic) <= 5 &&
    Math.abs(reading.diastolic - values.diastolic) <= 5
  );
}
