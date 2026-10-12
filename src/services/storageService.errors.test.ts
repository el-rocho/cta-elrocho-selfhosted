import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  StorageRequestError,
  addReadingToServer,
  clearAllReadingsOnServer,
  fetchReadingsFromServer,
  fetchSettingsFromServer,
  mergeBackupOnServer,
  saveSettingsToServer,
  DEFAULT_SETTINGS,
} from './storageService';

const reading = {
  id: 'reading-1',
  timestamp: '2026-10-12T08:00:00.000Z',
  systolic: 120,
  diastolic: 80,
  heartRate: 60,
  arm: 'left' as const,
};

const snapshot = {
  format: 'cta-elrocho-backup' as const,
  version: 1 as const,
  createdAt: '2026-10-12T09:00:00.000Z',
  readings: [],
  settings: DEFAULT_SETTINGS,
};

beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: vi.fn().mockReturnValue('session-token') });
});

afterEach(() => vi.unstubAllGlobals());

function response(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('errores tipados de storage', () => {
  it('rechaza fallos de red sin sustituir una consulta por una lista vacía', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(fetchReadingsFromServer()).rejects.toMatchObject({
      name: 'StorageRequestError',
      code: 'network',
    });
  });

  it('rechaza respuestas HTTP e incluye el status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(503, { error: 'unavailable' })));

    await expect(clearAllReadingsOnServer()).rejects.toMatchObject({
      code: 'http',
      status: 503,
    });
  });

  it('rechaza cuerpos inválidos en consultas y altas', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(response(200, { readings: [] }))
      .mockResolvedValueOnce(response(200, null))
      .mockResolvedValueOnce(response(200, { language: 7 })));

    await expect(fetchReadingsFromServer()).rejects.toMatchObject({ code: 'invalid-response' });
    await expect(addReadingToServer({ ...reading, id: undefined } as never)).rejects.toMatchObject({ code: 'invalid-response' });
    await expect(fetchSettingsFromServer()).rejects.toMatchObject({ code: 'invalid-response' });
  });

  it('no convierte una respuesta vacía de ajustes en los valores predeterminados', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(200, {})));

    await expect(fetchSettingsFromServer()).rejects.toMatchObject({ code: 'invalid-response' });
  });

  it('solo resuelve mutaciones cuando el servidor confirma success', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(response(200, { success: false }))
      .mockResolvedValueOnce(response(200, { success: true })));

    await expect(clearAllReadingsOnServer()).rejects.toMatchObject({ code: 'invalid-response' });
    await expect(saveSettingsToServer(DEFAULT_SETTINGS)).resolves.toBeUndefined();
  });

  it('tipa la ausencia de token y la previsualización obsoleta', async () => {
    vi.stubGlobal('localStorage', { getItem: vi.fn().mockReturnValue(null) });
    await expect(mergeBackupOnServer(snapshot, 'preview')).rejects.toMatchObject({
      code: 'session-token-required',
    });

    vi.stubGlobal('localStorage', { getItem: vi.fn().mockReturnValue('session-token') });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(409, { error: 'stale' })));
    await expect(mergeBackupOnServer(snapshot, 'preview')).rejects.toMatchObject({
      code: 'merge-preview-stale',
      status: 409,
    });
  });

  it('expone una clase de error distinguible por los consumidores', () => {
    const error = new StorageRequestError('http', 'fallo', 500);
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ code: 'http', status: 500 });
  });
});
