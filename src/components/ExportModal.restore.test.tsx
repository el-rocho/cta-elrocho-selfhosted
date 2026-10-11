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
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  }
});

it('auto-previews on file selection, shows the counts with a clean note, and merges directly with the preview token', async () => {
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
    expect(summaryItem(container, 'Añadidas')!.querySelector('strong')!.textContent).toBe('1');
    expect(summaryItem(container, 'Duplicadas idénticas')!.querySelector('strong')!.textContent).toBe('2');
    expect(summaryItem(container, 'Misma fecha/hora, datos distintos')!.querySelector('strong')!.textContent).toBe('0');
    const note = container.querySelector('.import-preview-card .import-preview-note')!;
    expect(note.classList.contains('merge-clean-note')).toBe(true);
    expect(note.classList.contains('merge-conflict-note')).toBe(false);
    expect(note.textContent).toContain('Mediciones nuevas: 1 · ya existentes omitidas: 2.');
    expect(note.querySelectorAll('button').length).toBe(0);
    expect(container.textContent).not.toContain('Aceptar y combinar');
    await act(async () => buttonByText(container, 'Combinar mediciones').click());
    expect(onRestoreBackup).toHaveBeenCalledWith(snapshot, 'merge', 'clean-token');
    expect(onPreviewBackupMerge).toHaveBeenCalledTimes(1);
    expect(confirm).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain('Aceptar y combinar');
    expect(container.querySelector('.import-status-box.success')?.textContent).toContain('añadidas: 1');
  } finally { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); vi.clearAllMocks(); }
});

it('emphasises conflicts with an amber warning note and a highlighted conflict counter', async () => {
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
    const note = container.querySelector('.import-preview-card .import-preview-note')!;
    expect(note.classList.contains('merge-conflict-note')).toBe(true);
    expect(note.classList.contains('merge-clean-note')).toBe(false);
    expect(note.classList.contains('warning')).toBe(false);
    expect(note.textContent).toContain('Mediciones con la misma fecha y hora pero datos distintos: 3. Se conservarán ambas versiones.');
    expect(note.querySelector('strong')).not.toBeNull();
    expect(note.querySelector('svg')).not.toBeNull();
    const conflictItem = summaryItem(container, 'Misma fecha/hora, datos distintos')!;
    expect(conflictItem.classList.contains('is-conflict')).toBe(true);
    expect(conflictItem.querySelector('strong')!.textContent).toBe('3');
    expect(summaryItem(container, 'Añadidas')!.querySelector('strong')!.textContent).toBe('1');
    expect(container.textContent).not.toContain('Aceptar y combinar');
    expect(onRestoreBackup).not.toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); vi.clearAllMocks(); }
});

it('shows a checking state, disables combine, and retries the preview before writing after a failure', async () => {
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
    await act(async () => { rejectFirst(new Error('preview failed')); });
    expect(container.querySelector('.import-status-box.error')).not.toBeNull();
    expect(buttonByText(container, 'Combinar mediciones').disabled).toBe(false);
    expect(container.textContent).toContain('Elegir otro archivo');
    expect(onRestoreBackup).not.toHaveBeenCalled();
    await act(async () => buttonByText(container, 'Combinar mediciones').click());
    expect(onPreviewBackupMerge).toHaveBeenCalledTimes(2);
    expect(onRestoreBackup).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Mediciones nuevas: 1');
    await act(async () => buttonByText(container, 'Combinar mediciones').click());
    expect(onRestoreBackup).toHaveBeenCalledTimes(1);
    expect(onRestoreBackup).toHaveBeenCalledWith(snapshot, 'merge', 'retry-token');
  } finally { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); vi.clearAllMocks(); }
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
    expect(summaryItem(container, 'Añadidas')!.querySelector('strong')!.textContent).toBe('1');
    await act(async () => buttonByText(container, 'Combinar mediciones').click());
    expect(onRestoreBackup).toHaveBeenCalledTimes(2);
    expect(onRestoreBackup).toHaveBeenLastCalledWith(snapshot, 'merge', 'fresh-token');
    expect(container.querySelector('.import-status-box.success')).not.toBeNull();
  } finally { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); vi.clearAllMocks(); }
});

it('shows the counts and the clean note in English', async () => {
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
    expect(summaryItem(container, 'Added')!.querySelector('strong')!.textContent).toBe('1');
    expect(summaryItem(container, 'Identical duplicates')!.querySelector('strong')!.textContent).toBe('2');
    expect(summaryItem(container, 'Same time, different data')!.querySelector('strong')!.textContent).toBe('0');
    const note = container.querySelector('.import-preview-card .import-preview-note')!;
    expect(note.classList.contains('merge-clean-note')).toBe(true);
    expect(note.textContent).toContain('New readings: 1 · already present, skipped: 2.');
    expect(buttonByText(container, 'Merge readings')).toBeTruthy();
  } finally { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); vi.clearAllMocks(); }
});
