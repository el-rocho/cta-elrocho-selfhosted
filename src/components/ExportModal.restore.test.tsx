// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { ExportModal } from './ExportModal';
import { LanguageProvider } from '../i18n/LanguageContext';
import { DEFAULT_SETTINGS } from '../services/storageService';
import { parseBackupContent, type AppBackupSnapshot } from '../utils/backupService';

vi.mock('../utils/backupService', () => ({ parseBackupContent: vi.fn() }));

it('keeps the active backup selected while its restoration is in progress', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = createRoot(container);
  let resolveRestore!: (count: number) => void;
  const onRestoreBackup = vi.fn().mockReturnValue(new Promise<number>((resolve) => { resolveRestore = resolve; }));
  const first: AppBackupSnapshot = { format: 'cta-elrocho-backup', version: 1, createdAt: '2026-10-01T00:00:00.000Z', readings: [], settings: DEFAULT_SETTINGS };
  const second = { ...first, createdAt: '2026-10-02T00:00:00.000Z' };
  vi.mocked(parseBackupContent).mockReturnValueOnce({ status: 'valid', snapshot: first })
    .mockReturnValueOnce({ status: 'valid', snapshot: second });
  class StubReader {
    result = '{}'; onload: ((event: { target: { result: string } }) => void) | null = null;
    onerror = null;
    readAsText() { this.onload?.({ target: this }); }
  }
  vi.stubGlobal('FileReader', StubReader); vi.stubGlobal('confirm', () => true);
  try {
    await act(async () => root.render(<LanguageProvider language="es"><ExportModal isOpen onClose={() => {}}
      sessions={[]} readings={[]} settings={DEFAULT_SETTINGS} onImportReadings={() => 0}
      onRestoreBackup={onRestoreBackup} onUpdateSettings={() => {}} onTriggerManualBackup={() => {}} />
    </LanguageProvider>));
    await act(async () => [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Importar'))!.click());
    const input = container.querySelector<HTMLInputElement>('input[type=file]')!;
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['{}'], 'backup.json')] });
    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
    await act(async () => [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Restaurar y reemplazar'))!.click());
    expect(input.disabled).toBe(true);
    expect([...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Elegir otro archivo'))?.disabled).toBe(true);
    await act(async () => { resolveRestore(0); });
    expect(onRestoreBackup).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); vi.clearAllMocks();
  }
});

it('reports restore failure without discarding the selected backup or claiming success', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onRestoreBackup = vi.fn().mockRejectedValue(new Error('failed'));
  vi.mocked(parseBackupContent).mockReturnValue({ status: 'valid', snapshot: {
    format: 'cta-elrocho-backup', version: 1, createdAt: '2026-10-01T00:00:00.000Z',
    readings: [], settings: DEFAULT_SETTINGS,
  } });
  class StubReader {
    result = '{}';
    onload: ((event: { target: { result: string } }) => void) | null = null;
    onerror = null;
    readAsText() { this.onload?.({ target: this }); }
  }
  vi.stubGlobal('FileReader', StubReader);
  vi.stubGlobal('confirm', () => true);
  try {
    await act(async () => root.render(
      <LanguageProvider language="es"><ExportModal isOpen onClose={() => {}} sessions={[]} readings={[]}
        settings={DEFAULT_SETTINGS} onImportReadings={() => 0} onRestoreBackup={onRestoreBackup}
        onUpdateSettings={() => {}} onTriggerManualBackup={() => {}} /></LanguageProvider>
    ));
    await act(async () => {
      [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Importar'))!.click();
    });
    await act(async () => {
      const input = container.querySelector<HTMLInputElement>('input[type=file]')!;
      Object.defineProperty(input, 'files', { configurable: true, value: [new File(['{}'], 'backup.json')] });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.textContent).toContain('Restaurar y reemplazar');
    await act(async () => {
      [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Restaurar y reemplazar'))!.click();
    });
    expect(onRestoreBackup).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Restaurar y reemplazar');
    expect(container.textContent).not.toContain('✓ Se han restaurado');
    expect(container.querySelector('.import-status-box.error')).not.toBeNull();
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  }
});
