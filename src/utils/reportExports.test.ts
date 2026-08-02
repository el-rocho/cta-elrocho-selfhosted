import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  BloodPressureReading,
  BloodPressureSession,
  GuidelineProfile,
} from '../types/bloodPressure';
import { buildCSVContent, filterSessionsByDateRange } from './exportCsv';
import { buildPDFMeasurementRowsHTML } from './pdfReportContent';

function discardedSession(): BloodPressureSession {
  const initial: BloodPressureReading = {
    id: 'discarded-initial',
    timestamp: '2026-07-31T09:00:00.000Z',
    systolic: 160,
    diastolic: 95,
    heartRate: 82,
    arm: 'left',
    takesAntihypertensiveMedication: false,
  };
  const effective: BloodPressureReading = {
    id: 'effective-reading',
    timestamp: '2026-07-31T09:05:00.000Z',
    systolic: 132,
    diastolic: 82,
    heartRate: 70,
    arm: 'left',
    takesAntihypertensiveMedication: false,
  };

  return {
    id: 'filtered-session',
    timestamp: initial.timestamp,
    readings: [initial, effective],
    averageSystolic: 132,
    averageDiastolic: 82,
    averageHeartRate: 70,
    discardedCount: 1,
    arm: 'left',
    notes: 'control',
  };
}

const profiles: Array<[GuidelineProfile, string]> = [
  ['esc-2024', 'Presión elevada'],
  ['aha-acc-2025', 'Hipertensión fase 1'],
  ['ish-2020', 'Presión normal'],
];

afterEach(() => vi.useRealTimers());

describe('history date filters', () => {
  it('uses clamped calendar months instead of fixed 30- and 90-day periods', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 31, 12, 0));
    const sessionAt = (id: string, timestamp: Date): BloodPressureSession => ({ ...discardedSession(), id, timestamp: timestamp.toISOString() });
    const sessions = [
      sessionAt('one-month-boundary', new Date(2026, 1, 28, 12, 0)),
      sessionAt('older-than-one-month', new Date(2026, 1, 28, 11, 59)),
      sessionAt('three-month-boundary', new Date(2025, 11, 31, 12, 0)),
    ];
    expect(filterSessionsByDateRange(sessions, { preset: '1month' }).map(({ id }) => id)).toEqual(['one-month-boundary']);
    expect(filterSessionsByDateRange(sessions, { preset: '3months' }).map(({ id }) => id)).toEqual(['one-month-boundary', 'older-than-one-month', 'three-month-boundary']);
  });
});

describe('clinical CSV export', () => {
  it.each(profiles)(
    'uses the effective session and %s classification',
    (guidelineProfile, expectedCategory) => {
      const csv = buildCSVContent(
        [discardedSession()],
        { preset: 'all' },
        { guidelineProfile, takesAntihypertensiveMedication: false },
        'es'
      );

      expect(csv).toContain(`"${expectedCategory}";2;1;`);
      expect(csv).toContain(';132;82;70;');
      expect(csv).not.toContain(';160;95;82;');
      expect(csv).toContain('Tomas_Descartadas');
    }
  );
});

describe('clinical PDF content', () => {
  it.each(profiles)(
    'uses the effective session and %s classification',
    (guidelineProfile, expectedCategory) => {
      const html = buildPDFMeasurementRowsHTML(
        [discardedSession()],
        'es',
        guidelineProfile
      );

      expect(html).toContain(expectedCategory);
      expect(html).toContain('>132</strong> mmHg');
      expect(html).toContain('>82</strong> mmHg');
      expect(html).toContain('Resultado de 1 toma efectiva; 1 descartada');
      expect(html).not.toContain('>160</strong> mmHg');
      expect(html).not.toContain('>95</strong> mmHg');
    }
  );
});
