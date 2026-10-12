import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { restoreBackupOnServer, importReadingsToServer, previewBackupMergeOnServer, mergeBackupOnServer, DEFAULT_SETTINGS } from './storageService';

const snapshot: Parameters<typeof restoreBackupOnServer>[0] = { format: 'cta-elrocho-backup', version: 1, createdAt: '2026-10-01T00:00:00.000Z', readings: [], settings: DEFAULT_SETTINGS };
beforeEach(() => vi.stubGlobal('localStorage', { getItem: () => 'test-token' }));
afterEach(() => vi.unstubAllGlobals());

it('returns the committed readings and settings from the server', async () => {
  const response = { readings: [], settings: DEFAULT_SETTINGS };
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => response });
  vi.stubGlobal('fetch', fetchMock);
  await expect(restoreBackupOnServer(snapshot)).resolves.toEqual(response);
  expect(fetchMock).toHaveBeenCalledWith('/api/backups/restore-replace', expect.objectContaining({
    method: 'POST', credentials: 'include', body: JSON.stringify(snapshot), headers: {
      'Content-Type': 'application/json', 'x-session-token': 'test-token',
    },
  }));
});

it('rejects a failed restoration instead of reporting zero successful readings', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
  await expect(restoreBackupOnServer(snapshot)).rejects.toThrow();
});

it('requires a locally stored session token before replace or merge', async () => {
  vi.stubGlobal('localStorage', { getItem: () => null });
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  await expect(restoreBackupOnServer(snapshot)).rejects.toThrow('SESSION_TOKEN_REQUIRED');
  await expect(importReadingsToServer([])).rejects.toThrow('SESSION_TOKEN_REQUIRED');
  expect(fetchMock).not.toHaveBeenCalled();
});

it('does not report a successful merge when the server rejects the import', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
  await expect(importReadingsToServer([])).rejects.toThrow();
});

it('does not report a successful merge after a network failure', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  await expect(importReadingsToServer([])).rejects.toThrow('offline');
});

it('rejects a network failure instead of claiming success', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  await expect(restoreBackupOnServer(snapshot)).rejects.toThrow('offline');
});


it('previews and commits a backup merge using explicit session token and exact snapshot', async () => {
  const preview = { addedCount: 1, duplicateCount: 2, conflictCount: 3, previewToken: 'preview-1' };
  const result = { addedCount: 1, duplicateCount: 2, conflictCount: 3, readings: [] };
  const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => preview })
    .mockResolvedValueOnce({ ok: true, json: async () => result });
  vi.stubGlobal('fetch', fetchMock);
  await expect(previewBackupMergeOnServer(snapshot)).resolves.toEqual(preview);
  await expect(mergeBackupOnServer(snapshot, preview.previewToken)).resolves.toEqual(result);
  expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/backups/merge-preview', expect.objectContaining({
    body: JSON.stringify(snapshot), headers: { 'Content-Type': 'application/json', 'x-session-token': 'test-token' },
  }));
  expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/backups/restore-merge', expect.objectContaining({
    body: JSON.stringify({ snapshot, previewToken: preview.previewToken }),
  }));
});

it('does not treat a stale preview response as a successful merge', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 409 }));
  await expect(mergeBackupOnServer(snapshot, 'stale')).rejects.toThrow('MERGE_PREVIEW_STALE');
});
