import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generate, generateSecret } from 'otplib';
import { verifyTotpToken } from './auth.js';

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
});
