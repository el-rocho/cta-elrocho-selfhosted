import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkServerHealth } from './serverHealthService';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('checkServerHealth', () => {
  it('accepts only a successful health response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(checkServerHealth('/api/health')).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/health',
      expect.objectContaining({ cache: 'no-store' })
    );
  });

  it.each([
    { ok: false, json: async () => ({ status: 'ok' }) },
    { ok: true, json: async () => ({ status: 'unavailable' }) },
  ])('rejects an unhealthy response', async (response) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    await expect(checkServerHealth('/api/health')).resolves.toBe(false);
  });

  it('treats network failures and missing URLs as unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(checkServerHealth('/api/health')).resolves.toBe(false);
    await expect(checkServerHealth('')).resolves.toBe(false);
  });

  it('uses the existing auth endpoint with a 1.6.0 server', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => { throw new SyntaxError('HTML response'); },
      })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await expect(checkServerHealth('/api/health')).resolves.toBe(true);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/auth/status',
      expect.objectContaining({ cache: 'no-store' })
    );
  });
});
