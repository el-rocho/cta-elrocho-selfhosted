import { expect, it } from 'vitest';
import { isRestoreSessionCurrent } from './restoreSession';

it('ignores a restore response after the login generation changes', () => {
  expect(isRestoreSessionCurrent(4, 5, 'user-a', 'user-b')).toBe(false);
});

it('ignores a restore response even when the same user logs in again', () => {
  expect(isRestoreSessionCurrent(4, 5, 'user-a', 'user-a')).toBe(false);
});

it('applies a restore response only to the same session and user', () => {
  expect(isRestoreSessionCurrent(4, 4, 'user-a', 'user-a')).toBe(true);
});
