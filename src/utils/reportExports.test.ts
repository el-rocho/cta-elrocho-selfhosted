import { describe, expect, it } from 'vitest';
import type {
  BloodPressureReading,
  BloodPressureSession,
  GuidelineProfile,
} from '../types/bloodPressure';
import { buildCSVContent } from './exportCsv';
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
