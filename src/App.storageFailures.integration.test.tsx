// @vitest-environment jsdom
//
// Garantías que se mantienen con el modelo simple de ajustes: un fallo de
// almacenamiento no vacía datos, no cierra Ajustes ni anuncia un éxito falso, y
// el borrado distingue cancelación, fallo real y borrado aplicado. Integración
// con App y los componentes reales (SettingsModal y EditReadingModal).
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from './services/storageService';
import type { AuthUser, BloodPressureReading } from './types/bloodPressure';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const USER_A: AuthUser = { id: 'user-1', username: 'user-a', role: 'admin', name: 'Paciente A', totp_enabled: false, created_at: '2026-01-01T00:00:00.000Z' };

const mocks = vi.hoisted(() => ({
  getAuthStatus: vi.fn(),
  fetchReadings: vi.fn(),
  fetchSettings: vi.fn(),
  clearAll: vi.fn(),
  resetDemo: vi.fn(),
  deleteReading: vi.fn(),
  deleteOutcome: undefined as unknown,
  reading: {
    id: 'reading-1',
    timestamp: '2026-10-12T08:00:00.000Z',
    systolic: 120,
    diastolic: 80,
    heartRate: 60,
    arm: 'left' as const,
  } satisfies BloodPressureReading,
}));

vi.mock('./services/authService', () => ({
  getAuthStatus: mocks.getAuthStatus,
  checkCurrentSession: vi.fn().mockResolvedValue({ reachable: false, user: null }),
  logout: vi.fn(),
}));

vi.mock('./services/storageService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./services/storageService')>();
  return {
    ...actual,
    fetchReadingsFromServer: mocks.fetchReadings,
    fetchSettingsFromServer: mocks.fetchSettings,
    clearAllReadingsOnServer: mocks.clearAll,
    resetDemoDataOnServer: mocks.resetDemo,
    deleteReadingFromServer: mocks.deleteReading,
    saveSettingsToServer: vi.fn().mockResolvedValue(undefined),
    addReadingToServer: vi.fn(),
    updateReadingOnServer: vi.fn(),
    updateMedicationContextForAllReadings: vi.fn(),
    deleteSessionFromServer: vi.fn(),
    importReadingsToServer: vi.fn(),
    previewBackupMergeOnServer: vi.fn(),
    mergeBackupOnServer: vi.fn(),
    restoreBackupOnServer: vi.fn(),
  };
});

vi.mock('./components/Header', () => ({
  Header: ({ onOpenSettingsModal }: { onOpenSettingsModal: () => void }) => (
    <button onClick={onOpenSettingsModal}>open-settings</button>
  ),
}));
vi.mock('./components/LoginModal', () => ({ LoginModal: () => null }));
vi.mock('./components/ReadingForm', () => ({ ReadingForm: () => null }));
vi.mock('./components/TrendChart', () => ({ TrendChart: () => null }));
vi.mock('./components/TrendInsights', () => ({ TrendInsights: () => null }));
vi.mock('./components/LegalNoticeModal', () => ({ LegalNoticeModal: () => null }));
vi.mock('./components/TotpSetupModal', () => ({ TotpSetupModal: () => null }));
vi.mock('./components/UserManagementModal', () => ({ UserManagementModal: () => null }));
vi.mock('./components/ExportModal', () => ({ ExportModal: () => null }));
vi.mock('./components/ReadingList', () => ({
  ReadingList: ({ sessions, onEditReading, onDeleteSingleReading }: {
    sessions: Array<{ readings: BloodPressureReading[] }>;
    onEditReading: (reading: BloodPressureReading) => void;
    onDeleteSingleReading: (id: string) => unknown;
  }) => (
    <div>
      <output data-testid="reading-count">{sessions.reduce((total, session) => total + session.readings.length, 0)}</output>
      <button onClick={() => onEditReading(mocks.reading)}>edit-reading</button>
      <button onClick={async () => { mocks.deleteOutcome = await onDeleteSingleReading('reading-1'); }}>delete-reading</button>
    </div>
  ),
}));

import { App } from './App';

let container: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.deleteOutcome = undefined;
  vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
  mocks.getAuthStatus.mockResolvedValue({ hasAdmin: true, user: USER_A });
  mocks.fetchReadings.mockResolvedValue([mocks.reading]);
  mocks.fetchSettings.mockResolvedValue({ ...DEFAULT_SETTINGS, patientName: 'Guardado' });
  mocks.clearAll.mockResolvedValue(undefined);
  mocks.resetDemo.mockResolvedValue([mocks.reading]);
  mocks.deleteReading.mockResolvedValue(undefined);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<App />);
    await Promise.resolve();
    await Promise.resolve();
  });
  await flush();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function click(label: string) {
  const button = [...container.querySelectorAll('button')].find((item) => (item.textContent ?? '').trim() === label);
  if (!button) throw new Error(`Botón no encontrado: ${label}`);
  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function readingCount(): string {
  return container.querySelector('[data-testid="reading-count"]')!.textContent!;
}

function settingsModalOpen(): boolean {
  return container.querySelector('.patient-profile-fields') !== null;
}

describe('Fallos de almacenamiento', () => {
  it('no vacía datos, no cierra Ajustes ni anuncia éxito al fallar el vaciado o los datos demo', async () => {
    mocks.resetDemo.mockRejectedValue(new Error('offline'));
    mocks.clearAll.mockRejectedValue(new Error('offline'));

    await click('open-settings');
    expect(settingsModalOpen()).toBe(true);

    await click('Restaurar datos Demo');
    expect(readingCount()).toBe('1');
    expect(settingsModalOpen()).toBe(true);
    expect(container.textContent).toContain('No se pudo completar la operación');
    expect(container.textContent).not.toContain('Se han restaurado los datos de ejemplo');

    await click('Eliminar todos los datos');
    expect(readingCount()).toBe('1');
    expect(settingsModalOpen()).toBe(true);
    expect(container.textContent).not.toContain('Se han eliminado todos los datos');
  });

  it('mantiene la medición y avisa cuando falla el borrado', async () => {
    mocks.deleteReading.mockRejectedValue(new Error('offline'));

    await click('delete-reading');
    await flush();

    expect(readingCount()).toBe('1');
    expect(container.textContent).toContain('No se pudo completar la operación');
  });

  it('distingue cancelación, fallo y éxito en el borrado disparado desde la lista', async () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));
    await click('delete-reading');
    await flush();
    expect(mocks.deleteOutcome).toBe('cancelled');
    expect(mocks.deleteReading).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain('No se pudo completar la operación');

    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    mocks.deleteReading.mockRejectedValueOnce(new Error('offline'));
    await click('delete-reading');
    await flush();
    expect(mocks.deleteOutcome).toBe('failed');

    mocks.deleteReading.mockResolvedValueOnce(undefined);
    await click('delete-reading');
    await flush();
    expect(mocks.deleteOutcome).toBe('deleted');
    expect(readingCount()).toBe('0');
  });

  it('cancelar el borrado desde el modal de edición no reporta error y lo deja abierto', async () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));

    await click('edit-reading');
    await click('Eliminar');
    await click('Sí, eliminar');
    await flush();

    expect(container.textContent).not.toContain('No se pudo eliminar la medición');
    expect(container.querySelector('#edit-systolic')).not.toBeNull();
  });

  it('muestra el aviso específico cuando el borrado desde el modal de edición falla de verdad', async () => {
    mocks.deleteReading.mockRejectedValue(new Error('offline'));

    await click('edit-reading');
    await click('Eliminar');
    await click('Sí, eliminar');
    await flush();

    expect(container.textContent).toContain('No se pudo eliminar la medición');
    expect(container.querySelector('#edit-systolic')).not.toBeNull();
  });
});
