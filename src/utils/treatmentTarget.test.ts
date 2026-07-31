import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../services/storageService';
import type { AppSettings } from '../types/bloodPressure';
import {
  assessTreatmentTarget,
  formatTreatmentTarget,
  getGuidelineTreatmentTarget,
} from './treatmentTarget';

function settings(overrides: Partial<AppSettings> = {}): AppSettings {
  return { ...DEFAULT_SETTINGS, takesAntihypertensiveMedication: true, ...overrides };
}

describe('recommended treatment targets', () => {
  it('uses the ESC 2024 treatment range and treats 96/70 as below target', () => {
    const assessment = assessTreatmentTarget(96, 70, settings());

    expect(assessment.targetLabel).toBe('120–129/70–79');
    expect(assessment.status).toBe('below');
  });

  it('uses the AHA/ACC 2025 upper target without inventing a lower bound', () => {
    const target = getGuidelineTreatmentTarget('aha-acc-2025');
    expect(formatTreatmentTarget(target)).toBe('<130/80');
    expect(
      assessTreatmentTarget(
        96,
        70,
        settings({ guidelineProfile: 'aha-acc-2025' })
      ).status
    ).toBe('within');
  });

  it('keeps empty custom minimums as an upper-only target', () => {
    const assessment = assessTreatmentTarget(
      96,
      70,
      settings({
        treatmentTargetMode: 'custom',
        customTargetSystolicMin: 0,
        customTargetSystolicMax: 129,
        customTargetDiastolicMin: 0,
        customTargetDiastolicMax: 79,
      })
    );

    expect(assessment.targetLabel).toBe('<130/80');
    expect(assessment.status).toBe('within');
  });

  it('uses the age-adjusted ISH 2020 range from age 65', () => {
    const target = getGuidelineTreatmentTarget('ish-2020', 65);
    expect(formatTreatmentTarget(target)).toBe('120–139/70–89');
  });

  it('honours a doctor-defined range', () => {
    const assessment = assessTreatmentTarget(
      134,
      84,
      settings({
        treatmentTargetMode: 'custom',
        customTargetSystolicMin: 110,
        customTargetSystolicMax: 135,
        customTargetDiastolicMin: 65,
        customTargetDiastolicMax: 85,
      })
    );

    expect(assessment.targetLabel).toBe('110–135/65–85');
    expect(assessment.status).toBe('within');
  });

  it('reports mixed values when one dimension is below and the other above', () => {
    const assessment = assessTreatmentTarget(110, 85, settings());
    expect(assessment.status).toBe('mixed');
  });
});
