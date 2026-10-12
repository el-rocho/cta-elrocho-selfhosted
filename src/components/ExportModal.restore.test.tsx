// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { ExportModal } from './ExportModal';
import { LanguageProvider } from '../i18n/LanguageContext';
import { DEFAULT_SETTINGS } from '../services/storageService';
import { parseBackupContent, type AppBackupSnapshot } from '../utils/backupService';

vi.mock('../utils/backupService', () => ({ parseBackupContent: vi.fn() }));

class StubReader {
  result = '{}';
  onload: ((event: { target: { result: string } }) => void) | null = null;
  onerror = null;
  readAsText() { this.onload?.({ target: this }); }
}

async function openImportTab(container: HTMLElement) {
  await act(async () => [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Importar'))!.click());
}

async function selectBackupFile(container: HTMLElement) {
  const input = container.querySelector<HTMLInputElement>('input[type=file]')!;
  Object.defineProperty(input, 'files', { configurable: true, value: [new File(['{}'], 'backup.json')] });
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
}

const buttonByText = (container: HTMLElement, text: string) =>
  [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)!;
const summaryItem = (container: HTMLElement, label: string) =>
  [...container.querySelectorAll('.import-summary-item')].find((el) => el.textContent?.includes(label));
const mergeCountItems = (container: HTMLElement) =>
  [...container.querySelectorAll('.backup-preview-grid .import-summary-item.merge-count')];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

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
  vi.stubGlobal('FileReader', StubReader); vi.stubGlobal('confirm', () => true);
  try {
    await act(async () => root.render(<LanguageProvider language="es"><ExportModal isOpen onClose={() => {}}
      sessions={[]} readings={[]} settings={DEFAULT_SETTINGS} onImportReadings={() => 0}
      onRestoreBackup={onRestoreBackup} onUpdateSettings={() => {}} onTriggerManualBackup={() => {}} />
    </LanguageProvider>));
    await openImportTab(container);
    const input = container.querySelector<HTMLInputElement>('input[type=file]')!;
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['{}'], 'backup.json')] });
    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
    await act(async () => buttonByText(container, 'Restaurar y reemplazar').click());
    expect(input.disabled).toBe(true);
    expect(buttonByText(container, 'Elegir otro archivo').disabled).toBe(true);
    await act(async () => { resolveRestore(0); });
    expect(onRestoreBackup).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => root.unmount()); container.remove();
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
  vi.stubGlobal('FileReader', StubReader);
  vi.stubGlobal('confirm', () => true);
  try {
    await act(async () => root.render(
      <LanguageProvider language="es"><ExportModal isOpen onClose={() => {}} sessions={[]} readings={[]}
        settings={DEFAULT_SETTINGS} onImportReadings={() => 0} onRestoreBackup={onRestoreBackup}
        onUpdateSettings={() => {}} onTriggerManualBackup={() => {}} /></LanguageProvider>
    ));
    await openImportTab(container);
    await selectBackupFile(container);
    expect(container.textContent).toContain('Restaurar y reemplazar');
    await act(async () => buttonByText(container, 'Restaurar y reemplazar').click());
    expect(onRestoreBackup).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Restaurar y reemplazar');
    expect(container.textContent).not.toContain('✓ Se han restaurado');
    expect(container.querySelector('.import-status-box.error')).not.toBeNull();
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

it('auto-previews on file selection, shows the five unified counters in a single grid, and merges directly with the preview token', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = createRoot(container);
  const snapshot: AppBackupSnapshot = { format: 'cta-elrocho-backup', version: 1, createdAt: '2026-10-01T00:00:00.000Z', readings: [], settings: DEFAULT_SETTINGS };
  vi.mocked(parseBackupContent).mockReturnValue({ status: 'valid', snapshot });
  vi.stubGlobal('FileReader', StubReader);
  const onPreviewBackupMerge = vi.fn().mockResolvedValue({ addedCount: 1, duplicateCount: 2, conflictCount: 0, previewToken: 'clean-token' });
  const onRestoreBackup = vi.fn().mockResolvedValue({ addedCount: 1, duplicateCount: 2, conflictCount: 0 });
  const confirm = vi.fn(); vi.stubGlobal('confirm', confirm);
  try {
    await act(async () => root.render(<LanguageProvider language="es"><ExportModal isOpen onClose={() => {}}
      sessions={[]} readings={[]} settings={DEFAULT_SETTINGS} onImportReadings={() => 0}
      onPreviewBackupMerge={onPreviewBackupMerge} onRestoreBackup={onRestoreBackup}
      onUpdateSettings={() => {}} onTriggerManualBackup={() => {}} /></LanguageProvider>));
    await openImportTab(container);
    await selectBackupFile(container);
    expect(onPreviewBackupMerge).toHaveBeenCalledWith(snapshot);
    // The five counters live in a single backup-preview-grid.
    const items = [...container.querySelectorAll('.import-summary-grid.backup-preview-grid .import-summary-item')];
    expect(items.length).toBe(5);
    expect(container.textContent).toContain('mediciones preparadas');
    expect(container.textContent).toContain('fecha de la copia');
    expect(summaryItem(container, 'tomas nuevas')!.querySelector('strong')!.textContent).toBe('1');
    expect(summaryItem(container, 'tomas duplicadas')!.querySelector('strong')!.textContent).toBe('2');
    expect(summaryItem(container, 'tomas misma fecha/hora')!.querySelector('strong')!.textContent).toBe('0');
    // The three merge counters carry the merge-count class so they fill the second row.
    expect(mergeCountItems(container).length).toBe(3);
    expect(mergeCountItems(container).map((el) => el.querySelector('strong')!.textContent)).toEqual(['1', '2', '0']);
    // The redundant informational card is gone.
    expect(container.querySelector('.merge-clean-note')).toBeNull();
    expect(container.querySelector('.merge-conflict-note')).toBeNull();
    expect(container.textContent).not.toContain('Mediciones nuevas: 1 · ya existentes omitidas: 2.');
    expect(container.textContent).not.toContain('Mediciones con la misma fecha y hora pero datos distintos');
    expect(container.textContent).not.toContain('Esta copia contiene las tomas originales');
    expect(container.textContent).not.toContain('Aceptar y combinar');
    await act(async () => buttonByText(container, 'Combinar mediciones').click());
    expect(onRestoreBackup).toHaveBeenCalledWith(snapshot, 'merge', 'clean-token');
    expect(onPreviewBackupMerge).toHaveBeenCalledTimes(1);
    expect(confirm).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain('Aceptar y combinar');
    expect(container.querySelector('.import-status-box.success')?.textContent).toContain('añadidas: 1');
  } finally { await act(async () => root.unmount()); container.remove(); }
});

it('emphasises conflicts with a highlighted conflict counter and no informational note', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = createRoot(container);
  const snapshot: AppBackupSnapshot = { format: 'cta-elrocho-backup', version: 1, createdAt: '2026-10-01T00:00:00.000Z', readings: [], settings: DEFAULT_SETTINGS };
  vi.mocked(parseBackupContent).mockReturnValue({ status: 'valid', snapshot });
  vi.stubGlobal('FileReader', StubReader);
  const onPreviewBackupMerge = vi.fn().mockResolvedValue({ addedCount: 1, duplicateCount: 2, conflictCount: 3, previewToken: 'token' });
  const onRestoreBackup = vi.fn();
  try {
    await act(async () => root.render(<LanguageProvider language="es"><ExportModal isOpen onClose={() => {}}
      sessions={[]} readings={[]} settings={DEFAULT_SETTINGS} onImportReadings={() => 0}
      onPreviewBackupMerge={onPreviewBackupMerge} onRestoreBackup={onRestoreBackup}
      onUpdateSettings={() => {}} onTriggerManualBackup={() => {}} /></LanguageProvider>));
    await openImportTab(container);
    await selectBackupFile(container);
    const conflictItem = summaryItem(container, 'tomas misma fecha/hora')!;
    expect(conflictItem.classList.contains('is-conflict')).toBe(true);
    expect(conflictItem.classList.contains('merge-count')).toBe(true);
    expect(conflictItem.querySelector('strong')!.textContent).toBe('3');
    expect(summaryItem(container, 'tomas nuevas')!.querySelector('strong')!.textContent).toBe('1');
    expect(mergeCountItems(container).length).toBe(3);
    // No amber warning note is rendered anymore.
    expect(container.querySelector('.merge-conflict-note')).toBeNull();
    expect(container.querySelector('.merge-clean-note')).toBeNull();
    expect(container.textContent).not.toContain('Se conservarán ambas versiones.');
    expect(container.textContent).not.toContain('Aceptar y combinar');
    expect(onRestoreBackup).not.toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); container.remove(); }
});

it('shows a checking state with only the two leading counters, disables combine, and retries the preview before writing after a failure', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = createRoot(container);
  const snapshot: AppBackupSnapshot = { format: 'cta-elrocho-backup', version: 1, createdAt: '2026-10-01T00:00:00.000Z', readings: [], settings: DEFAULT_SETTINGS };
  vi.mocked(parseBackupContent).mockReturnValue({ status: 'valid', snapshot });
  vi.stubGlobal('FileReader', StubReader);
  let rejectFirst!: (error: unknown) => void;
  const onPreviewBackupMerge = vi.fn()
    .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectFirst = reject; }))
    .mockResolvedValueOnce({ addedCount: 1, duplicateCount: 0, conflictCount: 0, previewToken: 'retry-token' });
  const onRestoreBackup = vi.fn().mockResolvedValue({ addedCount: 1, duplicateCount: 0, conflictCount: 0 });
  try {
    await act(async () => root.render(<LanguageProvider language="es"><ExportModal isOpen onClose={() => {}}
      sessions={[]} readings={[]} settings={DEFAULT_SETTINGS} onImportReadings={() => 0}
      onPreviewBackupMerge={onPreviewBackupMerge} onRestoreBackup={onRestoreBackup}
      onUpdateSettings={() => {}} onTriggerManualBackup={() => {}} /></LanguageProvider>));
    await openImportTab(container);
    await selectBackupFile(container);
    expect(buttonByText(container, 'Combinar mediciones').disabled).toBe(true);
    expect(container.textContent).toContain('Comprobando la combinación');
    expect(container.querySelector('.merge-checking-note')).not.toBeNull();
    // While the merge counters are unavailable only the two leading items are present.
    expect(container.querySelectorAll('.import-summary-grid.backup-preview-grid .import-summary-item').length).toBe(2);
    expect(mergeCountItems(container).length).toBe(0);
    await act(async () => { rejectFirst(new Error('preview failed')); });
    expect(container.querySelector('.import-status-box.error')).not.toBeNull();
    expect(buttonByText(container, 'Combinar mediciones').disabled).toBe(false);
    expect(container.textContent).toContain('Elegir otro archivo');
    expect(onRestoreBackup).not.toHaveBeenCalled();
    await act(async () => buttonByText(container, 'Combinar mediciones').click());
    expect(onPreviewBackupMerge).toHaveBeenCalledTimes(2);
    expect(onRestoreBackup).not.toHaveBeenCalled();
    expect(summaryItem(container, 'tomas nuevas')!.querySelector('strong')!.textContent).toBe('1');
    expect(mergeCountItems(container).length).toBe(3);
    await act(async () => buttonByText(container, 'Combinar mediciones').click());
    expect(onRestoreBackup).toHaveBeenCalledTimes(1);
    expect(onRestoreBackup).toHaveBeenCalledWith(snapshot, 'merge', 'retry-token');
  } finally { await act(async () => root.unmount()); container.remove(); }
});

it('never writes on a stale preview and recalculates it automatically', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = createRoot(container);
  const snapshot: AppBackupSnapshot = { format: 'cta-elrocho-backup', version: 1, createdAt: '2026-10-01T00:00:00.000Z', readings: [], settings: DEFAULT_SETTINGS };
  vi.mocked(parseBackupContent).mockReturnValue({ status: 'valid', snapshot });
  vi.stubGlobal('FileReader', StubReader);
  const onPreviewBackupMerge = vi.fn()
    .mockResolvedValueOnce({ addedCount: 1, duplicateCount: 0, conflictCount: 0, previewToken: 'stale-token' })
    .mockResolvedValueOnce({ addedCount: 1, duplicateCount: 0, conflictCount: 0, previewToken: 'fresh-token' });
  const onRestoreBackup = vi.fn()
    .mockRejectedValueOnce(new Error('MERGE_PREVIEW_STALE'))
    .mockResolvedValueOnce({ addedCount: 1, duplicateCount: 0, conflictCount: 0 });
  try {
    await act(async () => root.render(<LanguageProvider language="es"><ExportModal isOpen onClose={() => {}}
      sessions={[]} readings={[]} settings={DEFAULT_SETTINGS} onImportReadings={() => 0}
      onPreviewBackupMerge={onPreviewBackupMerge} onRestoreBackup={onRestoreBackup}
      onUpdateSettings={() => {}} onTriggerManualBackup={() => {}} /></LanguageProvider>));
    await openImportTab(container);
    await selectBackupFile(container);
    await act(async () => buttonByText(container, 'Combinar mediciones').click());
    expect(onRestoreBackup).toHaveBeenCalledTimes(1);
    expect(onRestoreBackup).toHaveBeenCalledWith(snapshot, 'merge', 'stale-token');
    expect(container.querySelector('.import-status-box.error')?.textContent).toContain('Las mediciones cambiaron');
    expect(onPreviewBackupMerge).toHaveBeenCalledTimes(2);
    expect(summaryItem(container, 'tomas nuevas')!.querySelector('strong')!.textContent).toBe('1');
    await act(async () => buttonByText(container, 'Combinar mediciones').click());
    expect(onRestoreBackup).toHaveBeenCalledTimes(2);
    expect(onRestoreBackup).toHaveBeenLastCalledWith(snapshot, 'merge', 'fresh-token');
    expect(container.querySelector('.import-status-box.success')).not.toBeNull();
  } finally { await act(async () => root.unmount()); container.remove(); }
});

it('shows the five unified counters and no informational card in English', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = createRoot(container);
  const snapshot: AppBackupSnapshot = { format: 'cta-elrocho-backup', version: 1, createdAt: '2026-10-01T00:00:00.000Z', readings: [], settings: DEFAULT_SETTINGS };
  vi.mocked(parseBackupContent).mockReturnValue({ status: 'valid', snapshot });
  vi.stubGlobal('FileReader', StubReader);
  const onPreviewBackupMerge = vi.fn().mockResolvedValue({ addedCount: 1, duplicateCount: 2, conflictCount: 0, previewToken: 'token' });
  const onRestoreBackup = vi.fn();
  try {
    await act(async () => root.render(<LanguageProvider language="en"><ExportModal isOpen onClose={() => {}}
      sessions={[]} readings={[]} settings={DEFAULT_SETTINGS} onImportReadings={() => 0}
      onPreviewBackupMerge={onPreviewBackupMerge} onRestoreBackup={onRestoreBackup}
      onUpdateSettings={() => {}} onTriggerManualBackup={() => {}} /></LanguageProvider>));
    await act(async () => [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Import'))!.click());
    await selectBackupFile(container);
    expect(container.textContent).toContain('measurements ready');
    expect(container.textContent).toContain('backup date');
    expect(summaryItem(container, 'new readings')!.querySelector('strong')!.textContent).toBe('1');
    expect(summaryItem(container, 'duplicate readings')!.querySelector('strong')!.textContent).toBe('2');
    expect(summaryItem(container, 'readings same date/time')!.querySelector('strong')!.textContent).toBe('0');
    expect(mergeCountItems(container).length).toBe(3);
    expect(container.querySelector('.merge-clean-note')).toBeNull();
    expect(container.textContent).not.toContain('New readings: 1 · already present, skipped: 2.');
    expect(container.textContent).not.toContain('This backup includes original readings');
    expect(buttonByText(container, 'Merge readings')).toBeTruthy();
  } finally { await act(async () => root.unmount()); container.remove(); }
});
