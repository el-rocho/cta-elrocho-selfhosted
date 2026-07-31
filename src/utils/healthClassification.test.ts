import { describe, expect, it } from 'vitest';
import type { BloodPressureReading, GuidelineProfile, HealthAssessment } from '../types/bloodPressure';
import {
  getHealthAssessment,
  getHealthCategory,
  requiresPulsePressureConfirmation,
} from './healthClassification';

function alertKeys(assessment: HealthAssessment): string[] {
  return [...assessment.safetyAlerts, ...assessment.alerts].map((alert) => alert.key);
}

function nonLocalizedAssessment(assessment: HealthAssessment) {
  const { name: _categoryName, description: _categoryDescription, ...category } = assessment.category;
  const normalizeAlerts = (alerts: HealthAssessment['alerts']) =>
    alerts.map(({ name: _name, description: _description, ...alert }) => alert);
  return {
    ...assessment,
    category,
    alerts: normalizeAlerts(assessment.alerts),
    safetyAlerts: normalizeAlerts(assessment.safetyAlerts),
  };
}

function structuralShape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(structuralShape);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, structuralShape(item)])
    );
  }
  return typeof value;
}

describe('ESC 2024 home classification', () => {
  const classify = (systolic: number, diastolic: number) =>
    getHealthCategory(systolic, diastolic, 'es', 'esc-2024').key;

  it.each([
    [119, 69, 'normal'],
    [120, 69, 'elevated'],
    [119, 70, 'elevated'],
    [134, 84, 'elevated'],
    [135, 84, 'hypertension'],
    [134, 85, 'hypertension'],
  ] as const)('classifies %i/%i as %s', (systolic, diastolic, expected) => {
    expect(classify(systolic, diastolic)).toBe(expected);
  });
});

describe('AHA/ACC 2025 classification applied to home log', () => {
  const classify = (systolic: number, diastolic: number) =>
    getHealthCategory(systolic, diastolic, 'es', 'aha-acc-2025').key;

  it.each([
    [119, 79, 'normal'],
    [120, 79, 'elevated'],
    [129, 79, 'elevated'],
    [130, 79, 'stage1'],
    [129, 80, 'stage1'],
    [139, 89, 'stage1'],
    [140, 89, 'stage2'],
    [139, 90, 'stage2'],
  ] as const)('classifies %i/%i as %s', (systolic, diastolic, expected) => {
    expect(classify(systolic, diastolic)).toBe(expected);
  });
});

describe('ISH 2020 home threshold', () => {
  const classify = (systolic: number, diastolic: number) =>
    getHealthCategory(systolic, diastolic, 'es', 'ish-2020').key;

  it.each([
    [134, 84, 'belowThreshold'],
    [135, 84, 'aboveThreshold'],
    [134, 85, 'aboveThreshold'],
  ] as const)('classifies %i/%i as %s', (systolic, diastolic, expected) => {
    expect(classify(systolic, diastolic)).toBe(expected);
  });
});

describe('universal safety and precedence', () => {
  const profiles: GuidelineProfile[] = ['esc-2024', 'aha-acc-2025', 'ish-2020'];

  it.each(profiles)('uses the universal extreme state for %s', (profile) => {
    const assessment = getHealthAssessment(180, 80, 70, 'es', profile);
    expect(assessment.category.key).toBe('extreme');
    expect(assessment.category.colorRole).toBe('red');
    expect(assessment.safetyAlerts.map((alert) => alert.key)).toContain('extremeHighPressure');
  });

  it('keeps the low-value observation when an extreme systolic value prevails', () => {
    const assessment = getHealthAssessment(185, 55, 70, 'es', 'esc-2024');
    expect(assessment.category.key).toBe('extreme');
    expect(assessment.culprit).toBe('systolic');
    expect(assessment.alerts.map((alert) => alert.key)).toContain('lowBloodPressure');
  });

  it('uses the highest guideline category reached by either value', () => {
    const assessment = getHealthAssessment(118, 86, 70, 'es', 'esc-2024');
    expect(assessment.category.key).toBe('hypertension');
    expect(assessment.culprit).toBe('diastolic');
  });

  it('keeps non-extreme hypertension orange', () => {
    const assessment = getHealthAssessment(150, 95, 70, 'es', 'aha-acc-2025');
    expect(assessment.category.key).toBe('stage2');
    expect(assessment.category.colorRole).toBe('orange');
    expect(assessment.safetyAlerts).toHaveLength(0);
  });
});

describe('characterization at universal pressure boundaries', () => {
  it.each([
    [179, false],
    [180, true],
    [181, true],
  ] as const)('evaluates the systolic extreme threshold at %i mmHg', (systolic, expected) => {
    const assessment = getHealthAssessment(systolic, 80, 70, 'es', 'esc-2024');
    expect(assessment.category.key === 'extreme').toBe(expected);
    expect(assessment.safetyAlerts.some((alert) => alert.key === 'extremeHighPressure')).toBe(expected);
  });

  it.each([
    [119, false],
    [120, true],
    [121, true],
  ] as const)('evaluates the diastolic extreme threshold at %i mmHg', (diastolic, expected) => {
    const assessment = getHealthAssessment(130, diastolic, 70, 'es', 'esc-2024');
    expect(assessment.category.key === 'extreme').toBe(expected);
    expect(assessment.safetyAlerts.some((alert) => alert.key === 'extremeHighPressure')).toBe(expected);
  });

  it.each([
    [89, true],
    [90, false],
    [91, false],
  ] as const)('evaluates the low systolic notice at %i mmHg', (systolic, expected) => {
    expect(alertKeys(getHealthAssessment(systolic, 65, 70, 'es', 'esc-2024')).includes('lowBloodPressure')).toBe(expected);
  });

  it.each([
    [59, true],
    [60, false],
    [61, false],
  ] as const)('evaluates the low diastolic notice at %i mmHg', (diastolic, expected) => {
    expect(alertKeys(getHealthAssessment(110, diastolic, 70, 'es', 'esc-2024')).includes('lowBloodPressure')).toBe(expected);
  });
});

describe('characterization at pulse boundaries', () => {
  it.each([
    [49, true],
    [50, false],
    [51, false],
  ] as const)('evaluates the low-pulse threshold at %i ppm', (heartRate, expected) => {
    expect(alertKeys(getHealthAssessment(110, 65, heartRate, 'es', 'esc-2024')).includes('bradycardia')).toBe(expected);
  });

  it.each([
    [99, false],
    [100, false],
    [101, true],
  ] as const)('evaluates the high-pulse threshold at %i ppm', (heartRate, expected) => {
    expect(alertKeys(getHealthAssessment(110, 65, heartRate, 'es', 'esc-2024')).includes('tachycardia')).toBe(expected);
  });
});

describe('characterization at pulse-pressure boundaries', () => {
  it.each([
    [104, 80, 24, true, 'narrowPulsePressure'],
    [105, 80, 25, false, null],
    [106, 80, 26, false, null],
    [139, 80, 59, false, null],
    [140, 80, 60, false, null],
    [141, 80, 61, true, 'widePulsePressure'],
  ] as const)(
    'evaluates pulse pressure %i/%i = %i mmHg',
    (systolic, diastolic, expectedPulsePressure, requiresConfirmation, expectedAlert) => {
      expect(requiresPulsePressureConfirmation(systolic, diastolic)).toBe(requiresConfirmation);
      const assessment = getHealthAssessment(
        systolic,
        diastolic,
        70,
        'es',
        'esc-2024',
        true
      );
      expect(assessment.pulsePressure).toBe(expectedPulsePressure);
      if (expectedAlert) {
        expect(alertKeys(assessment)).toContain(expectedAlert);
      } else {
        expect(alertKeys(assessment)).not.toContain('narrowPulsePressure');
        expect(alertKeys(assessment)).not.toContain('widePulsePressure');
      }
    }
  );
});

describe('clinical invariants outside the selected guide', () => {
  it.each(['esc-2024', 'aha-acc-2025', 'ish-2020'] as const)(
    'classifies identically with and without medication for %s',
    (profile) => {
      const baseReading: BloodPressureReading = {
        id: 'medication-invariant',
        timestamp: '2026-07-31T10:00:00.000Z',
        systolic: 132,
        diastolic: 82,
        heartRate: 74,
        arm: 'left',
      };
      const withoutMedication = { ...baseReading, takesAntihypertensiveMedication: false };
      const withMedication = { ...baseReading, takesAntihypertensiveMedication: true };

      const assess = (reading: BloodPressureReading) =>
        getHealthAssessment(
          reading.systolic,
          reading.diastolic,
          reading.heartRate,
          'es',
          profile
        );

      expect(assess(withMedication)).toEqual(assess(withoutMedication));
    }
  );

  it.each(['esc-2024', 'aha-acc-2025', 'ish-2020'] as const)(
    'keeps equivalent result structure in Spanish and English for %s',
    (profile) => {
      const spanish = getHealthAssessment(185, 55, 101, 'es', profile, true);
      const english = getHealthAssessment(185, 55, 101, 'en', profile, true);

      expect(structuralShape(spanish)).toEqual(structuralShape(english));
      expect(nonLocalizedAssessment(spanish)).toEqual(nonLocalizedAssessment(english));
      expect(spanish.category.name).not.toBe(english.category.name);
      expect(spanish.safetyAlerts[0].name).not.toBe(english.safetyAlerts[0].name);
    }
  );
});
