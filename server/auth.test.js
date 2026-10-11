import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generate, generateSecret } from 'otplib';
import { deleteSessionBestEffort, verifyTotpToken } from './auth.js';

describe('TOTP verification', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-10T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects an incorrect token instead of accepting the pending verification promise', async () => {
    const secret = generateSecret();
    const validToken = await generate({ secret });
    const invalidToken = validToken === '000000' ? '000001' : '000000';

    const result = await verifyTotpToken(invalidToken, secret);

    expect(result).toBe(false);
  });

  it('accepts a valid token after resolving the verification promise', async () => {
    const secret = generateSecret();
    const validToken = await generate({ secret });

    const result = await verifyTotpToken(validToken, secret);

    expect(result).toBe(true);
  });

  it('accepts the immediately previous time window to tolerate transmission delay', async () => {
    const secret = generateSecret();
    const previousWindowToken = await generate({
      secret,
      epoch: Date.now() / 1000 - 30,
    });

    const result = await verifyTotpToken(previousWindowToken, secret);

    expect(result).toBe(true);
  });

  it.each([
    ['a future window', 30],
    ['a token older than the allowed previous window', -60],
  ])('rejects %s', async (_description, secondsOffset) => {
    const secret = generateSecret();
    const token = await generate({
      secret,
      epoch: Date.now() / 1000 + secondsOffset,
    });

    const result = await verifyTotpToken(token, secret);

    expect(result).toBe(false);
  });
});

describe('invalid session cleanup', () => {
  it('does not turn an already invalid session into an authentication error when cleanup fails', async () => {
    const cleanupError = new Error('database is read-only');
    const db = {
      run: vi.fn().mockRejectedValue(cleanupError),
    };
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(deleteSessionBestEffort(db, 'stale-session')).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith(
      'No se pudo limpiar una sesión inválida:',
      cleanupError
    );
    consoleSpy.mockRestore();
  });
});
