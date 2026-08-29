import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  AppSettings,
  BloodPressureReading,
  BloodPressureSession,
  GuidelineProfile,
} from '../types/bloodPressure';
import { buildCSVContent, filterSessionsByDateRange } from './exportCsv';
import { buildPDFMeasurementRowsHTML } from './pdfReportContent';
import { buildPDFPatientInfoHTML, buildPDFResultTypeLegendHTML, generateBloodPressureScatterHTML } from './pdfGenerator';
import { DEFAULT_SETTINGS } from '../services/storageService';

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

function settings(overrides: Partial<AppSettings> = {}): AppSettings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

function medicatedSession(): BloodPressureSession {
  const session = discardedSession();
  return {
    ...session,
    readings: session.readings.map((reading) => ({ ...reading, takesAntihypertensiveMedication: true })),
  };
}

function averageSession(): BloodPressureSession {
  return { ...discardedSession(), id: 'average-session', discardedCount: 0 };
}

function individualSession(): BloodPressureSession {
  const session = discardedSession();
  const reading = session.readings[1];
  return { ...session, id: 'individual-session', timestamp: reading.timestamp, readings: [reading], discardedCount: 0 };
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

      expect(csv).toContain(`false;;"${expectedCategory}";2;1;`);
      expect(csv).toContain(';132;82;70;');
      expect(csv).not.toContain(';160;95;82;');
      expect(csv).toContain('Tomas_Descartadas');
      expect(csv).toContain('PAM_Estimada_mmHg');
      expect(csv).toContain('Umbral_AMPA_135_85_Superado');
      expect(csv).toContain(';50;99;false;');
      expect(csv).toContain('# Carga presiva domiciliaria: Mediciones ≥135/85 0 % · 0 de 1 sesiones');
      expect(csv).toContain('# Presión Arterial Media estimada: 99 mmHg');
      expect(csv).toContain('# Presión de pulso media: 50 mmHg');
      expect(csv).toContain('# Aviso: La información proporcionada no debe ser interpretada en ningún caso como un diagnóstico.');
      expect(csv).toContain('# Importante: Para cualquier decisión consulte siempre con su médico.');
    }
  );

  it('exports the target once in metadata and the shared arrow label for each medicated session', () => {
    const csv = buildCSVContent(
      [medicatedSession(), discardedSession()],
      { preset: 'all' },
      {
        guidelineProfile: 'esc-2024',
        takesAntihypertensiveMedication: true,
        treatmentTargetMode: 'custom',
        customTargetSystolicMin: 120,
        customTargetSystolicMax: 129,
        customTargetDiastolicMin: 70,
        customTargetDiastolicMax: 79,
      },
      'es'
    );

    expect(csv).toContain('Contexto_Medicacion;Estado_Respecto_Objetivo;Clasificacion_PA');
    expect(csv).not.toContain('Objetivo_Terapeutico_mmHg');
    expect(csv).toContain('# Objetivo terapéutico: Personalizado · 120–129/70–79 mmHg');
    expect(csv).toContain('true;"↑ Objetivo";"Presión elevada";');
    expect(csv).toContain('false;;"Presión elevada";');
  });

  it('exports an explicit result type for individual, averaged and filtered sessions', () => {
    const csv = buildCSVContent(
      [individualSession(), averageSession(), discardedSession()],
      { preset: 'all' },
      { takesAntihypertensiveMedication: false },
      'es'
    );

    expect(csv).toContain('Tomas_Descartadas;Tipo_Resultado;Notas');
    expect(csv).toContain(';1;0;"Medición individual";');
    expect(csv).toContain(';2;0;"Media de varias mediciones";');
    expect(csv).toContain(';2;1;"Media filtrada";');
  });
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
      expect(html).toContain('Media de 1 medición');
      expect(html).not.toContain('>160</strong> mmHg');
      expect(html).not.toContain('>95</strong> mmHg');
    }
  );

  it('adds the existing arrow label to every medicated PDF measurement', () => {
    const html = buildPDFMeasurementRowsHTML(
      [medicatedSession(), discardedSession()],
      'es',
      'esc-2024',
      settings({
        showInformationalLabels: true,
        takesAntihypertensiveMedication: true,
        treatmentTargetMode: 'custom',
        customTargetSystolicMin: 120,
        customTargetSystolicMax: 129,
        customTargetDiastolicMin: 70,
        customTargetDiastolicMax: 79,
      })
    );

    expect(html).toContain('data-treatment-target-status="above"');
    expect(html).toContain('↑ Objetivo');
    expect(html).not.toContain('Objetivo personalizado: 120–129/70–79 mmHg');
    expect(html.match(/<td[^>]*text-align:center;">/g)).toHaveLength(2);
  });

  it('places the therapeutic target after medication using the existing separators', () => {
    const reportSettings = settings({
      showInformationalLabels: true,
      takesAntihypertensiveMedication: true,
      treatmentTargetMode: 'custom',
      customTargetSystolicMin: 118,
      customTargetSystolicMax: 128,
      customTargetDiastolicMin: 68,
      customTargetDiastolicMax: 78,
    });
    const html = buildPDFPatientInfoHTML(
      { patientName: 'Paciente de prueba', patientAge: 74, takesAntihypertensiveMedication: true },
      reportSettings,
      'es'
    );

    expect(html).toContain(
      'Paciente de prueba | 74 a. | <strong>Medicación antihipertensiva: Sí</strong> | Objetivo 118–128/68–78 mmHg'
    );
  });

  it('hides informational classifications and targets while preserving safety notices', () => {
    const html = buildPDFMeasurementRowsHTML(
      [medicatedSession()],
      'es',
      'esc-2024',
      settings({ showInformationalLabels: false, takesAntihypertensiveMedication: true })
    );

    expect(html).not.toContain('data-treatment-target-status');
    expect(html).not.toContain('Presión elevada');
  });

  it('omits the medication block when antihypertensive medication is disabled', () => {
    const html = buildPDFPatientInfoHTML(
      { patientName: 'Paciente sin medicación', patientAge: 74, takesAntihypertensiveMedication: false },
      settings({ takesAntihypertensiveMedication: false }),
      'es'
    );

    expect(html).toBe('Paciente sin medicación | 74 a.');
    expect(html).not.toContain('Medicación antihipertensiva');
    expect(html).not.toContain('Objetivo');
  });

  it('keeps medication and target context when patient identity is hidden', () => {
    const reportSettings = settings({ takesAntihypertensiveMedication: true });
    const html = buildPDFPatientInfoHTML(
      { patientName: 'Nombre oculto', hidePatientData: true, takesAntihypertensiveMedication: true },
      reportSettings,
      'es'
    );

    expect(html).not.toContain('Nombre oculto');
    expect(html).toContain('Medicación antihipertensiva: Sí');
    expect(html).toContain('Objetivo 120–129/70–79 mmHg');
  });

  it('renders the three result-type letter markers and their explanatory legend', () => {
    const rows = buildPDFMeasurementRowsHTML(
      [individualSession(), averageSession(), discardedSession()],
      'es',
      'esc-2024',
      settings()
    );
    const legend = buildPDFResultTypeLegendHTML('es');

    expect(rows).toContain('data-result-type="individual"');
    expect(rows).toContain('data-result-type="average"');
    expect(rows).toContain('data-result-type="filtered"');
    expect(rows).toContain('background:rgba(100,116,139,0.14); color:#111827;');
    expect(legend).toMatch(/data-result-type-legend="individual"[\s\S]*>I<\/span>Medición individual/);
    expect(legend).toMatch(/data-result-type-legend="average"[\s\S]*>M<\/span>Media de varias mediciones/);
    expect(legend).toMatch(/data-result-type-legend="filtered"[\s\S]*>F<\/span>Media filtrada de varias mediciones/);
    expect(legend).toContain('background:rgba(59,130,246,0.14); color:#111827;');
  });
});

describe('PDF blood pressure scatter plot', () => {
  it('plots every effective session and explains each highlighted zone', () => {
    const base = discardedSession();
    const isolated = { ...base, id: 'isolated', averageSystolic: 150, averageDiastolic: 80 };
    const extreme = { ...base, id: 'extreme', averageSystolic: 181, averageDiastolic: 80 };
    const extremeBoth = { ...base, id: 'extreme-both', averageSystolic: 185, averageDiastolic: 125 };
    const html = generateBloodPressureScatterHTML([base, isolated, extreme, extremeBoth], 'es');
    expect(html.match(/data-reading-point="true"/g)).toHaveLength(4);
    expect(html).toContain('Patrón sistólico aislado: 1');
    expect(html).toContain('Sin valores destacados: 1');
    expect(html).toContain('Valor muy alto: 1');
    expect(html).toContain('Ambos valores muy altos: 1');
    expect(html).toContain('Diastólica (mmHg)');
    expect(html).toContain('Sistólica (mmHg)');
    expect(html).not.toContain('Dispersión PAS/PAD');
    expect(html).toContain('width="940" height="480"');
  });
});
