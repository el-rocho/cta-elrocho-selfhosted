import type { BloodPressureSession } from '../types/bloodPressure';

export const HOME_BP_SYSTOLIC_THRESHOLD = 135;
export const HOME_BP_DIASTOLIC_THRESHOLD = 85;
export const MIN_HOME_BP_LOAD_SESSIONS = 6;
export const MIN_HOME_BP_LOAD_DAYS = 3;

export interface CardiovascularMetrics {
  pulsePressure: { average: number };
  estimatedMap: { average: number; minimum: number; maximum: number };
  pressureLoad: {
    totalSessions: number;
    elevatedSessions: number;
    elevatedSystolicSessions: number;
    elevatedDiastolicSessions: number;
    elevatedPercentage: number;
    systolicPercentage: number;
    diastolicPercentage: number;
    dayCount: number;
    hasSufficientData: boolean;
  };
}

function percentage(count: number, total: number): number {
  return total === 0 ? 0 : Math.round((count / total) * 100);
}

function localDayKey(timestamp: string): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function calculateEstimatedMeanArterialPressure(systolic: number, diastolic: number): number {
  return Math.round(diastolic + (systolic - diastolic) / 3);
}

export function calculateCardiovascularMetrics(sessions: BloodPressureSession[]): CardiovascularMetrics {
  const pulsePressureValues = sessions.map(
    (session) => session.averageSystolic - session.averageDiastolic
  );
  const mapValues = sessions.map((session) => calculateEstimatedMeanArterialPressure(
    session.averageSystolic,
    session.averageDiastolic
  ));
  const elevatedSystolicSessions = sessions.filter((session) => session.averageSystolic >= HOME_BP_SYSTOLIC_THRESHOLD).length;
  const elevatedDiastolicSessions = sessions.filter((session) => session.averageDiastolic >= HOME_BP_DIASTOLIC_THRESHOLD).length;
  const elevatedSessions = sessions.filter(
    (session) => session.averageSystolic >= HOME_BP_SYSTOLIC_THRESHOLD || session.averageDiastolic >= HOME_BP_DIASTOLIC_THRESHOLD
  ).length;
  const totalSessions = sessions.length;
  const dayCount = new Set(sessions.map((session) => localDayKey(session.timestamp))).size;

  return {
    pulsePressure: {
      average: pulsePressureValues.length === 0
        ? 0
        : Math.round(pulsePressureValues.reduce((sum, value) => sum + value, 0) / pulsePressureValues.length),
    },
    estimatedMap: {
      average: mapValues.length === 0 ? 0 : Math.round(mapValues.reduce((sum, value) => sum + value, 0) / mapValues.length),
      minimum: mapValues.length === 0 ? 0 : Math.min(...mapValues),
      maximum: mapValues.length === 0 ? 0 : Math.max(...mapValues),
    },
    pressureLoad: {
      totalSessions,
      elevatedSessions,
      elevatedSystolicSessions,
      elevatedDiastolicSessions,
      elevatedPercentage: percentage(elevatedSessions, totalSessions),
      systolicPercentage: percentage(elevatedSystolicSessions, totalSessions),
      diastolicPercentage: percentage(elevatedDiastolicSessions, totalSessions),
      dayCount,
      hasSufficientData: totalSessions >= MIN_HOME_BP_LOAD_SESSIONS && dayCount >= MIN_HOME_BP_LOAD_DAYS,
    },
  };
}
