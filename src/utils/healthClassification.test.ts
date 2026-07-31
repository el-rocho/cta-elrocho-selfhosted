import { describe, expect, it } from 'vitest';
import type { GuidelineProfile } from '../types/bloodPressure';
import { getHealthAssessment, getHealthCategory } from './healthClassification';

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
