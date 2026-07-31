import { describe, expect, it } from 'vitest';
import { getReadingValidationError, needsPulsePressureConfirmation } from './readingValidation';

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
