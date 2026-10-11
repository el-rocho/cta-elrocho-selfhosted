import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkCurrentSession, getAuthStatus, listUsers, verifyAndEnableTotp } from './authService';
import { fetchReadingsFromServer, fetchSettingsFromServer } from './storageService';
import { onSessionInvalid } from './sessionGuard';

const listener = vi.fn();

const jsonResponse = (data: unknown) => ({
  ok: true,
  status: 200,
  json: vi.fn().mockResolvedValue(data),
});

describe('consultas autenticadas sin caché', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue('session-test'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  it('solicita mediciones y ajustes directamente al servidor', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({}));
    vi.stubGlobal('fetch', fetchMock);

    await fetchReadingsFromServer();
    await fetchSettingsFromServer();

    expect(fetchMock).toHaveBeenNthCalledWith(1, expect.stringMatching(/^\/api\/readings\?fresh=/), expect.objectContaining({ cache: 'no-store' }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringMatching(/^\/api\/settings\?fresh=/), expect.objectContaining({ cache: 'no-store' }));
  });

  it('solicita el estado y la lista de usuarios sin reutilizar respuestas', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ hasAdmin: true, userCount: 1, user: null }))
      .mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    await getAuthStatus();
    await listUsers();

    expect(fetchMock).toHaveBeenNthCalledWith(1, expect.stringMatching(/^\/api\/auth\/status\?fresh=/), expect.objectContaining({ cache: 'no-store' }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringMatching(/^\/api\/users\?fresh=/), expect.objectContaining({ cache: 'no-store' }));
  });
});

describe('sesión revocada por el servidor', () => {
  let removeItem: ReturnType<typeof vi.fn>;
  let unsubscribe: () => void;

  beforeEach(() => {
    vi.restoreAllMocks();
    listener.mockClear();
    removeItem = vi.fn();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue('session-test'),
      setItem: vi.fn(),
      removeItem,
    });
    unsubscribe = onSessionInvalid(listener);
  });

  afterEach(() => {
    unsubscribe();
  });

  const unauthorized = { ok: false, status: 401, json: vi.fn().mockResolvedValue({ error: 'No autorizado' }) };
  const serverError = { ok: false, status: 500, json: vi.fn().mockResolvedValue({ error: 'Fallo' }) };

  it('entrega códigos y marca la sesión revocada sin borrarla antes de finalizar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      success: true,
      sessionsRevoked: true,
      recoveryCodes: ['TEST-CODE'],
    })));

    const result = await verifyAndEnableTotp('000000');

    expect(result).toEqual({
      success: true,
      sessionsRevoked: true,
      recoveryCodes: ['TEST-CODE'],
    });
    expect(listener).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('cierra la sesión local cuando el servidor responde 401 a las mediciones', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(unauthorized));

    const readings = await fetchReadingsFromServer();

    expect(readings).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(removeItem).toHaveBeenCalledWith('cta_session_token');
  });

  it('no cierra la sesión ante un error del servidor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(serverError));

    await fetchSettingsFromServer();

    expect(listener).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('informa de sesión caducada cuando el servidor responde sin usuario', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ hasAdmin: true, userCount: 1, user: null }),
    }));

    const result = await checkCurrentSession();

    expect(result).toEqual({ reachable: true, user: null });
  });

  it('no da por caducada la sesión si el servidor no responde', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin red')));

    const result = await checkCurrentSession();

    expect(result).toEqual({ reachable: false, user: null });
    expect(listener).not.toHaveBeenCalled();
  });
});
