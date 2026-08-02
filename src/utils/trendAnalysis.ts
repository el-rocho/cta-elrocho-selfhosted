import type { BloodPressureSession, GuidelineProfile, HealthSeverity } from '../types/bloodPressure';
import { getHealthCategory } from './healthClassification';

export const TREND_WINDOW_DAYS = 28;
export const MIN_TREND_SESSIONS = 3;
export const MIN_TREND_DAYS = 3;

export type LongTermTrendRange = '28days' | '3months' | '6months' | '1year';
export type TrendAnalysisStatus = 'insufficient' | 'ready';
export type ComparisonCoverage = 'sparse' | 'supported';

export interface DailyAverage {
  dayKey: string;
  timestamp: string;
  sessions: BloodPressureSession[];
  sessionCount: number;
  averageSystolic: number;
  averageDiastolic: number;
  averageHeartRate: number;
  notes?: string;
}
export interface DailyTrendSeries {
  dailyAverages: DailyAverage[];
  rangeStart?: string;
  rangeEnd?: string;
}

export interface TrendPattern {
  categoryKey: HealthSeverity;
  matchingDays: number;
  totalDays: number;
}

export interface FortnightComparison {
  coverage: ComparisonCoverage;
  firstDays: number;
  lastDays: number;
  firstAverageSystolic: number;
  firstAverageDiastolic: number;
  lastAverageSystolic: number;
  lastAverageDiastolic: number;
  systolicDifference: number;
  diastolicDifference: number;
}

export interface TrendAnalysis {
  status: TrendAnalysisStatus;
  sessionsUsed: number;
  daysUsed: number;
  requiredSessions: number;
  requiredDays: number;
  windowDays: number;
  periodStart?: string;
  periodEnd?: string;
  averageSystolic?: number;
  averageDiastolic?: number;
  comparison?: FortnightComparison;
  pattern?: TrendPattern;
}

function getLocalDayKey(timestamp: string): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfLocalDay(timestamp: string): Date {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getLatestSession(sessions: BloodPressureSession[]): BloodPressureSession | undefined {
  return sessions.reduce<BloodPressureSession | undefined>((latest, session) => {
    if (!latest) return session;
    return new Date(session.timestamp).getTime() > new Date(latest.timestamp).getTime()
      ? session
      : latest;
  }, undefined);
}

function getRangeStart(latestTimestamp: string, range: LongTermTrendRange): Date {
  const start = startOfLocalDay(latestTimestamp);
  if (range === '28days') {
    start.setDate(start.getDate() - 27);
  } else if (range === '3months') {
    start.setMonth(start.getMonth() - 3);
  } else if (range === '6months') {
    start.setMonth(start.getMonth() - 6);
  } else {
    start.setFullYear(start.getFullYear() - 1);
  }
  return start;
}

export function buildDailyAverages(sessions: BloodPressureSession[]): DailyAverage[] {
  const byDay = new Map<string, {
    timestamp: string;
    sessions: BloodPressureSession[];
    systolicTotal: number;
    diastolicTotal: number;
    heartRateTotal: number;
  }>();

  sessions.forEach((session) => {
    const dayKey = getLocalDayKey(session.timestamp);
    const current = byDay.get(dayKey);
    if (current) {
      current.sessions.push(session);
      current.systolicTotal += session.averageSystolic;
      current.diastolicTotal += session.averageDiastolic;
      current.heartRateTotal += session.averageHeartRate;
      if (new Date(session.timestamp).getTime() < new Date(current.timestamp).getTime()) {
        current.timestamp = session.timestamp;
      }
      return;
    }

    byDay.set(dayKey, {
      timestamp: session.timestamp,
      sessions: [session],
      systolicTotal: session.averageSystolic,
      diastolicTotal: session.averageDiastolic,
      heartRateTotal: session.averageHeartRate,
    });
  });

  return [...byDay.entries()]
    .map(([dayKey, value]) => {
      const notes = value.sessions
        .map((session) => session.notes?.trim())
        .filter((note): note is string => Boolean(note));
      const sessionCount = value.sessions.length;
      return {
        dayKey,
        timestamp: value.timestamp,
        sessions: value.sessions,
        sessionCount,
        averageSystolic: Math.round(value.systolicTotal / sessionCount),
        averageDiastolic: Math.round(value.diastolicTotal / sessionCount),
        averageHeartRate: Math.round(value.heartRateTotal / sessionCount),
        notes: notes.length > 0 ? [...new Set(notes)].join(' | ') : undefined,
      };
    })
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export function buildDailyTrendSeries(
  sessions: BloodPressureSession[],
  range: LongTermTrendRange
): DailyTrendSeries {
  const latestSession = getLatestSession(sessions);
  if (!latestSession) return { dailyAverages: [] };

  const rangeStart = getRangeStart(latestSession.timestamp, range);
  const rangeEnd = startOfLocalDay(latestSession.timestamp);
  rangeEnd.setHours(23, 59, 59, 999);
  const sessionsInRange = sessions.filter((session) => {
    const timestamp = new Date(session.timestamp).getTime();
    return timestamp >= rangeStart.getTime() && timestamp <= rangeEnd.getTime();
  });

  return {
    dailyAverages: buildDailyAverages(sessionsInRange),
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
  };
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundedAverage(days: DailyAverage[], field: 'averageSystolic' | 'averageDiastolic'): number {
  return Math.round(average(days.map((day) => day[field])));
}

function buildFortnightComparison(
  dailyAverages: DailyAverage[],
  latestTimestamp: string
): FortnightComparison | undefined {
  const secondHalfStart = startOfLocalDay(latestTimestamp);
  secondHalfStart.setDate(secondHalfStart.getDate() - 13);
  const firstHalf = dailyAverages.filter(
    (day) => new Date(day.timestamp).getTime() < secondHalfStart.getTime()
  );
  const lastHalf = dailyAverages.filter(
    (day) => new Date(day.timestamp).getTime() >= secondHalfStart.getTime()
  );
  if (firstHalf.length === 0 || lastHalf.length === 0) return undefined;

  const firstAverageSystolic = roundedAverage(firstHalf, 'averageSystolic');
  const firstAverageDiastolic = roundedAverage(firstHalf, 'averageDiastolic');
  const lastAverageSystolic = roundedAverage(lastHalf, 'averageSystolic');
  const lastAverageDiastolic = roundedAverage(lastHalf, 'averageDiastolic');

  return {
    coverage: firstHalf.length >= 2 && lastHalf.length >= 2 ? 'supported' : 'sparse',
    firstDays: firstHalf.length,
    lastDays: lastHalf.length,
    firstAverageSystolic,
    firstAverageDiastolic,
    lastAverageSystolic,
    lastAverageDiastolic,
    systolicDifference: lastAverageSystolic - firstAverageSystolic,
    diastolicDifference: lastAverageDiastolic - firstAverageDiastolic,
  };
}

export function analyzeBloodPressureTrends(
  sessions: BloodPressureSession[],
  guidelineProfile: GuidelineProfile
): TrendAnalysis {
  const series = buildDailyTrendSeries(sessions, '28days');
  const dailyAverages = series.dailyAverages;
  const sessionsUsed = dailyAverages.reduce((sum, day) => sum + day.sessionCount, 0);
  const base = {
    sessionsUsed,
    daysUsed: dailyAverages.length,
    requiredSessions: MIN_TREND_SESSIONS,
    requiredDays: MIN_TREND_DAYS,
    windowDays: TREND_WINDOW_DAYS,
    periodStart: dailyAverages[0]?.timestamp,
    periodEnd: dailyAverages[dailyAverages.length - 1]?.timestamp,
  };

  if (
    sessionsUsed < MIN_TREND_SESSIONS ||
    dailyAverages.length < MIN_TREND_DAYS
  ) {
    return {
      status: 'insufficient',
      ...base,
    };
  }

  const averageSystolic = roundedAverage(dailyAverages, 'averageSystolic');
  const averageDiastolic = roundedAverage(dailyAverages, 'averageDiastolic');
  const categoryCounts = new Map<HealthSeverity, number>();
  dailyAverages.forEach((day) => {
    const categoryKey = getHealthCategory(
      day.averageSystolic,
      day.averageDiastolic,
      'es',
      guidelineProfile
    ).key;
    categoryCounts.set(categoryKey, (categoryCounts.get(categoryKey) ?? 0) + 1);
  });
  const highestCount = Math.max(...categoryCounts.values());
  const dominantCategories = [...categoryCounts.entries()].filter(
    ([, count]) => count === highestCount
  );
  const pattern = dominantCategories.length === 1
    ? {
        categoryKey: dominantCategories[0][0],
        matchingDays: dominantCategories[0][1],
        totalDays: dailyAverages.length,
      }
    : undefined;

  return {
    status: 'ready',
    ...base,
    averageSystolic,
    averageDiastolic,
    comparison: buildFortnightComparison(
      dailyAverages,
      series.rangeEnd ?? dailyAverages[dailyAverages.length - 1].timestamp
    ),
    pattern,
  };
}
