import { describe, expect, it } from 'vitest';
import {
  getReadingValidationError,
  isReadingMetricPlausible,
  needsPulsePressureConfirmation,
} from './readingValidation';

describe('reading metric plausibility ranges', () => {
  it.each([
    ['systolic', 49, false],
    ['systolic', 50, true],
    ['systolic', 260, true],
    ['systolic', 261, false],
    ['diastolic', 29, false],
    ['diastolic', 30, true],
    ['diastolic', 160, true],
    ['diastolic', 161, false],
    ['heartRate', 29, false],
    ['heartRate', 30, true],
    ['heartRate', 220, true],
    ['heartRate', 221, false],
  ] as const)('accepts %s=%i: %s', (metric, value, expected) => {
    expect(isReadingMetricPlausible(metric, value)).toBe(expected);
  });

  it('rejects empty, fractional and non-finite values', () => {
    expect(isReadingMetricPlausible('systolic', '')).toBe(false);
    expect(isReadingMetricPlausible('diastolic', 80.5)).toBe(false);
    expect(isReadingMetricPlausible('heartRate', Number.NaN)).toBe(false);
  });
});

describe('reading validation at pulse-pressure boundaries', () => {
  it.each([
    [104, 80, true],
    [105, 80, false],
    [106, 80, false],
    [139, 80, false],
    [140, 80, false],
    [141, 80, true],
  ] as const)(
    'evaluates confirmation for %i/%i',
    (systolic, diastolic, expected) => {
      const values = { systolic, diastolic, heartRate: 70 };
      expect(getReadingValidationError(values)).toBeNull();
      expect(needsPulsePressureConfirmation(values)).toBe(expected);
    }
  );
});
