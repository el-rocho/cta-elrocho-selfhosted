import type { BloodPressureReading } from '../types/bloodPressure';
import { requiresPulsePressureConfirmation } from './healthClassification';

export type ReadingValidationError = 'invalidValues' | 'diastolicNotLower';
export interface ReadingValues { systolic: number; diastolic: number; heartRate: number }

export function getReadingValidationError(values: ReadingValues): ReadingValidationError | null {
  const { systolic, diastolic, heartRate } = values;
  if (
    !Number.isInteger(systolic) || !Number.isInteger(diastolic) || !Number.isInteger(heartRate) ||
    systolic < 50 || systolic > 260 || diastolic < 30 || diastolic > 160 ||
    heartRate < 30 || heartRate > 220
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
