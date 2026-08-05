import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAdminServerStatus } from './serverStatusService';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('getAdminServerStatus', () => {
  it('uses the protected endpoint and sends the active session token', async () => {
    const payload = { status: 'ok', checkedAt: '2026-08-04T12:00:00.000Z' };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json; charset=utf-8' },
      json: async () => payload,
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => 'session-token') });

    const result = await getAdminServerStatus('/api/health');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/admin\/system-status\?fresh=/),
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        headers: { 'x-session-token': 'session-token' },
      }),
    );
    expect(result).toMatchObject(payload);
    expect(result.connectionLatencyMs).toBeGreaterThanOrEqual(0);
  });

  it('rejects unauthorized responses', async () => {
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => null) });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    await expect(getAdminServerStatus('/api/health')).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('identifies servers without the detailed status endpoint', async () => {
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => 'session-token') });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(getAdminServerStatus('/api/health')).rejects.toMatchObject({ code: 'unsupported-version' });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'text/html' },
    }));
    await expect(getAdminServerStatus('/api/health')).rejects.toMatchObject({ code: 'unsupported-version' });
  });
});
