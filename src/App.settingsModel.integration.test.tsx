// @vitest-environment jsdom
//
// Integración con componentes reales (App + SettingsModal + ReadingForm +
// EditReadingModal + ExportModal) del MODELO SIMPLE de ajustes:
//  1. el modal no tiene borrador: se enlaza en vivo a los ajustes confirmados y
//     refleja cualquier cambio confirmado;
//  2. las escrituras se serializan en una cola de un solo vuelo (a lo sumo una
//     petición en curso; la última intención se envía al terminar la anterior),
//     con aplicación optimista y reversión a los ajustes confirmados si el
//     servidor rechaza, más aviso de error;
//  3. un único estado "ajustes cargados con éxito" bloquea toda escritura de
//     ajustes (modal, modo de entrada del formulario o del modal de edición y
//     frecuencia de copias) con aviso, mientras no haya llegado una carga
//     correcta;
//  4. una restauración, un cierre o una invalidación de sesión descartan lo
//     pendiente y lo que está en vuelo, de modo que ninguna respuesta tardía
//     reaplique los valores anteriores.
// Cada bloque corresponde a un defecto real de las arquitecturas anteriores.
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from './services/storageService';
import type { AppSettings, AuthUser, BloodPressureReading } from './types/bloodPressure';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const USER_A: AuthUser = { id: 'user-1', username: 'user-a', role: 'admin', name: 'Paciente A', totp_enabled: false, created_at: '2026-01-01T00:00:00.000Z' };
const USER_B: AuthUser = { id: 'user-2', username: 'user-b', role: 'user', name: 'Paciente B', totp_enabled: false, created_at: '2026-01-01T00:00:00.000Z' };

const mocks = vi.hoisted(() => ({
  getAuthStatus: vi.fn(),
  fetchReadings: vi.fn(),
  fetchSettings: vi.fn(),
  saveSettings: vi.fn(),
  updateMedication: vi.fn(),
  deleteReading: vi.fn(),
  restoreBackup: vi.fn(),
  previewBackupMerge: vi.fn(),
  parseBackupContent: vi.fn(),
  logout: vi.fn(),
  deleteOutcome: undefined as unknown,
  downloadBackup: vi.fn(),
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
  logout: mocks.logout,
}));

vi.mock('./services/storageService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./services/storageService')>();
  return {
    ...actual,
    fetchReadingsFromServer: mocks.fetchReadings,
    fetchSettingsFromServer: mocks.fetchSettings,
    saveSettingsToServer: mocks.saveSettings,
    updateMedicationContextForAllReadings: mocks.updateMedication,
    deleteReadingFromServer: mocks.deleteReading,
    restoreBackupOnServer: mocks.restoreBackup,
    previewBackupMergeOnServer: mocks.previewBackupMerge,
    addReadingToServer: vi.fn(),
    updateReadingOnServer: vi.fn(),
    deleteSessionFromServer: vi.fn(),
    clearAllReadingsOnServer: vi.fn(),
    resetDemoDataOnServer: vi.fn(),
    importReadingsToServer: vi.fn(),
    mergeBackupOnServer: vi.fn(),
  };
});

// El modal de exportación real interpreta la copia con este analizador.
vi.mock('./utils/backupService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./utils/backupService')>();
  return { ...actual, parseBackupContent: mocks.parseBackupContent, downloadBackup: mocks.downloadBackup };
});

vi.mock('./components/Header', () => ({
  Header: ({ onOpenExportModal, onOpenSettingsModal, onLogout }: {
    onOpenExportModal: () => void;
    onOpenSettingsModal: () => void;
    onLogout: () => void;
  }) => (
    <div>
      <button onClick={onOpenSettingsModal}>open-settings</button>
      <button onClick={onOpenExportModal}>open-export</button>
      <button onClick={onLogout}>logout</button>
    </div>
  ),
}));

vi.mock('./components/LoginModal', () => ({
  LoginModal: ({ onLoginSuccess }: { onLoginSuccess: (user: AuthUser) => void }) => (
    <div>
      <button onClick={() => onLoginSuccess(USER_A)}>login-user-a</button>
      <button onClick={() => onLoginSuccess(USER_B)}>login-user-b</button>
    </div>
  ),
}));

// La lista se sustituye por un observador del estado real del App y por los
// disparadores que abren los modales reales de edición y borrado.
vi.mock('./components/ReadingList', () => ({
  ReadingList: ({ settings, sessions, onEditReading, onDeleteSingleReading }: {
    settings: AppSettings;
    sessions: Array<{ readings: BloodPressureReading[] }>;
    onEditReading: (reading: BloodPressureReading) => void;
    onDeleteSingleReading: (id: string) => unknown;
  }) => (
    <div>
      <div
        data-testid="app-state"
        data-patient-name={settings.patientName ?? ''}
        data-medication={String(settings.takesAntihypertensiveMedication)}
        data-arm={settings.defaultArm}
        data-input-mode={settings.preferredInputMode}
        data-backup-frequency={settings.backupFrequency}
        data-reading-count={sessions.reduce((total, session) => total + session.readings.length, 0)}
        data-readings-medication={sessions.flatMap((session) => session.readings.map((item) => String(item.takesAntihypertensiveMedication))).join(',')}
      />
      <button onClick={() => onEditReading(mocks.reading)}>edit-reading</button>
      <button onClick={async () => { mocks.deleteOutcome = await onDeleteSingleReading('reading-1'); }}>delete-reading</button>
    </div>
  ),
}));

vi.mock('./components/TrendChart', () => ({ TrendChart: () => null }));
vi.mock('./components/TrendInsights', () => ({ TrendInsights: () => null }));
vi.mock('./components/LegalNoticeModal', () => ({ LegalNoticeModal: () => null }));
vi.mock('./components/TotpSetupModal', () => ({ TotpSetupModal: () => null }));
vi.mock('./components/UserManagementModal', () => ({ UserManagementModal: () => null }));

import { App } from './App';
import { notifySessionInvalid } from './services/sessionGuard';

let container: HTMLDivElement;
let root: Root;

function userSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return { ...DEFAULT_SETTINGS, patientName: 'Real', ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.deleteOutcome = undefined;
  vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
  mocks.getAuthStatus.mockResolvedValue({ hasAdmin: true, user: USER_A });
  mocks.fetchReadings.mockResolvedValue([mocks.reading]);
  mocks.fetchSettings.mockResolvedValue(userSettings());
  mocks.saveSettings.mockResolvedValue(undefined);
  mocks.updateMedication.mockResolvedValue(undefined);
  mocks.deleteReading.mockResolvedValue(undefined);
  mocks.logout.mockResolvedValue(undefined);
  mocks.restoreBackup.mockResolvedValue({ readings: [], settings: userSettings() });
  mocks.previewBackupMerge.mockResolvedValue({ addedCount: 0, duplicateCount: 0, conflictCount: 0, previewToken: 'token' });
  mocks.parseBackupContent.mockReturnValue({
    status: 'valid',
    snapshot: { format: 'cta-elrocho-backup', version: 1, createdAt: '2026-10-01T00:00:00.000Z', readings: [], settings: userSettings() },
  });
  mocks.downloadBackup.mockReturnValue('cta-backup-2026-10-12_00-00-00.json');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

class StubReader {
  result = '{}';
  onload: ((event: { target: { result: string } }) => void) | null = null;
  onerror = null;
  readAsText() { this.onload?.({ target: { result: this.result } }); }
}

function findButton(label: string): HTMLButtonElement {
  const button = [...container.querySelectorAll('button')].find((item) => (
    (item.textContent ?? '').trim() === label || item.getAttribute('aria-label') === label
  ));
  if (!button) throw new Error(`Botón no encontrado: ${label}`);
  return button as HTMLButtonElement;
}

function hasButton(label: string): boolean {
  return [...container.querySelectorAll('button')].some((item) => (
    (item.textContent ?? '').trim() === label || item.getAttribute('aria-label') === label
  ));
}

function isActive(label: string): boolean {
  return findButton(label).className.includes('active');
}

async function clickButton(label: string) {
  const button = findButton(label);
  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function clickSelector(selector: string) {
  const element = container.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Elemento no encontrado: ${selector}`);
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
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

function setNativeValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function setPatientName(value: string) {
  const input = patientNameInput();
  await act(async () => {
    setNativeValue(input, value);
    await Promise.resolve();
  });
}

function patientNameInput(): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('.patient-profile-input[type="text"]');
  if (!input) throw new Error('El modal de Ajustes no está abierto');
  return input;
}

async function submitReadingForm() {
  const form = container.querySelector<HTMLFormElement>('form.bp-form');
  if (!form) throw new Error('El formulario de medición no está en pantalla');
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
  });
}

function readingInput(id: string): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(id);
  if (!input) throw new Error(`Entrada de medición no encontrada: ${id}`);
  return input;
}

function settingsModalOpen(): boolean {
  return container.querySelector('.patient-profile-fields') !== null;
}

function medicationDialogOpen(): boolean {
  return container.querySelector('.medication-context-dialog') !== null;
}

function appState(key: string): string | null {
  return container.querySelector('[data-testid="app-state"]')!.getAttribute(`data-${key}`);
}

function loadErrorBanner(): HTMLElement | null {
  return container.querySelector<HTMLElement>('[data-testid="data-load-error"]');
}

function loadStateBanner(): HTMLElement | null {
  return container.querySelector<HTMLElement>('[data-testid="data-loading"], [data-testid="data-load-error"]');
}

async function renderApp() {
  await act(async () => {
    root.render(<App />);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  await flush();
}

async function openSettings() {
  await clickButton('open-settings');
}

async function openExportModal() {
  await clickButton('open-export');
}

async function restoreFromFile() {
  await openExportModal();
  await clickButton('Importar / Restaurar');
  const input = container.querySelector<HTMLInputElement>('input[type=file]')!;
  Object.defineProperty(input, 'files', { configurable: true, value: [new File(['{}'], 'backup.json')] });
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
  await flush();
  await clickButton('Restaurar y reemplazar');
  await flush();
}

describe('Ajustes cargados: ninguna escritura con valores por defecto', () => {
  it('si falla la carga inicial, avisa y no permite guardar valores por defecto', async () => {
    mocks.fetchSettings.mockRejectedValue(new Error('offline'));

    await renderApp();

    // La falta de datos no queda silenciosa: hay estado de error visible.
    expect(loadErrorBanner()).not.toBeNull();
    expect(loadErrorBanner()!.textContent).toContain('No se pudieron cargar los datos del servidor');
    expect(appState('reading-count')).toBe('0');

    await openSettings();
    // El modal se abre igualmente, pero solo puede escribir si hay ajustes.
    expect(settingsModalOpen()).toBe(true);
    await clickButton('Brazo Derecho');
    await flush();

    expect(mocks.saveSettings).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Tus ajustes aún no están disponibles');
    expect(isActive('Brazo Izquierdo')).toBe(true);
    expect(appState('arm')).toBe('left');
  });

  it('bloquea el modo de entrada y la frecuencia de copias durante la carga, y los libera con los ajustes reales', async () => {
    // Camino real del defecto: acceso con la carga de ajustes todavía en vuelo.
    mocks.getAuthStatus.mockResolvedValue({ hasAdmin: true, user: null });
    let resolveSettings!: (value: AppSettings) => void;
    mocks.fetchSettings.mockReturnValueOnce(new Promise<AppSettings>((resolve) => { resolveSettings = resolve; }));

    await renderApp();
    await clickButton('login-user-a');
    await flush();

    expect(loadStateBanner()).not.toBeNull();

    // El formulario real (modo de entrada) no puede escribir durante la carga.
    await clickButton('Teclado');
    await flush();
    expect(mocks.saveSettings).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Tus ajustes aún no están disponibles');
    expect(appState('input-mode')).toBe('keyboard');
    expect(hasButton('Teclado')).toBe(true);

    // La frecuencia de copias del modal de exportación real, tampoco.
    await openExportModal();
    await clickButton('Semanal');
    await flush();
    expect(mocks.saveSettings).not.toHaveBeenCalled();
    expect(appState('backup-frequency')).toBe('disabled');
    expect(isActive('No')).toBe(true);

    // El modo de entrada del modal de edición real, tampoco.
    await clickButton('edit-reading');
    await clickSelector('.edit-header-toggle');
    await flush();
    expect(mocks.saveSettings).not.toHaveBeenCalled();
    expect(appState('input-mode')).toBe('keyboard');
    expect(container.textContent).toContain('Tus ajustes aún no están disponibles');

    // Se abre Ajustes antes de tiempo: el modal muestra lo que hay y, en cuanto
    // llegan los ajustes confirmados, los refleja sin haber guardado nada.
    await openSettings();
    expect(patientNameInput().value).toBe('');

    await act(async () => {
      resolveSettings(userSettings({ patientName: 'Real' }));
      await Promise.resolve();
      await Promise.resolve();
    });
    await flush();

    expect(patientNameInput().value).toBe('Real');
    expect(appState('backup-frequency')).toBe('disabled');
    expect(mocks.saveSettings).not.toHaveBeenCalled();
    expect(mocks.saveSettings).not.toHaveBeenCalledWith(expect.objectContaining({ patientName: '' }));
    expect(mocks.saveSettings).not.toHaveBeenCalledWith(expect.objectContaining({ guidelineProfile: 'esc-2024' }));

    // Con los ajustes cargados, los mismos escritores sí guardan.
    await clickButton('Teclado');
    await flush();
    await clickButton('Semanal');
    await flush();

    expect(mocks.saveSettings).toHaveBeenLastCalledWith(expect.objectContaining({
      patientName: 'Real',
      preferredInputMode: 'wheel',
      backupFrequency: 'weekly',
    }));
    expect(appState('input-mode')).toBe('wheel');
    expect(appState('backup-frequency')).toBe('weekly');
  });

  it('reintentar la carga libera los escritores cuando el servidor vuelve', async () => {
    mocks.fetchSettings.mockRejectedValueOnce(new Error('offline'));

    await renderApp();
    await openSettings();
    await clickButton('Brazo Derecho');
    await flush();
    expect(mocks.saveSettings).not.toHaveBeenCalled();

    mocks.fetchSettings.mockResolvedValue(userSettings({ patientName: 'Real', defaultArm: 'left' }));
    await clickButton('Reintentar');
    await flush();

    expect(loadErrorBanner()).toBeNull();
    expect(patientNameInput().value).toBe('Real');

    await clickButton('Brazo Derecho');
    await flush();
    expect(mocks.saveSettings).toHaveBeenLastCalledWith(expect.objectContaining({
      patientName: 'Real',
      defaultArm: 'right',
    }));
  });
});

describe('Cola de escritura de ajustes', () => {
  it('mantiene una sola petición en vuelo y envía la última intención al terminar', async () => {
    let resolveFirst!: () => void;
    mocks.saveSettings.mockReturnValueOnce(new Promise<void>((resolve) => { resolveFirst = resolve; }));

    await renderApp();
    await openSettings();
    await setPatientName('Primero');
    await setPatientName('Segundo');
    await setPatientName('Tercero');

    // A lo sumo una petición en curso: las intenciones posteriores esperan.
    expect(mocks.saveSettings).toHaveBeenCalledTimes(1);
    expect(mocks.saveSettings).toHaveBeenLastCalledWith(expect.objectContaining({ patientName: 'Primero' }));

    await act(async () => {
      resolveFirst();
      await Promise.resolve();
      await Promise.resolve();
      await flush();
    });

    // Al terminar la anterior se envía la última intención, no las intermedias.
    expect(mocks.saveSettings).toHaveBeenCalledTimes(2);
    expect(mocks.saveSettings).toHaveBeenLastCalledWith(expect.objectContaining({ patientName: 'Tercero' }));
    expect(patientNameInput().value).toBe('Tercero');
  });

  it('revierte a los ajustes confirmados y avisa cuando el servidor rechaza', async () => {
    mocks.saveSettings.mockRejectedValueOnce(new Error('offline'));

    await renderApp();
    await openSettings();
    await setPatientName('Fallido');
    await flush();

    expect(mocks.saveSettings).toHaveBeenCalledWith(expect.objectContaining({ patientName: 'Fallido' }));
    expect(container.textContent).toContain('No se pudieron guardar los ajustes');
    // Reversión a lo confirmado, también en lo que muestra el modal.
    expect(appState('patient-name')).toBe('Real');
    expect(patientNameInput().value).toBe('Real');
  });

  it('no resucita un cambio fallido al enviar la intención que esperaba en la cola', async () => {
    let rejectFirst!: (error: Error) => void;
    mocks.saveSettings
      .mockReturnValueOnce(new Promise<void>((_resolve, reject) => { rejectFirst = reject; }))
      .mockResolvedValueOnce(undefined);

    await renderApp();
    await openSettings();
    await clickButton('Brazo Derecho');
    await setPatientName('Nuevo');

    expect(mocks.saveSettings).toHaveBeenCalledTimes(1);

    await act(async () => {
      rejectFirst(new Error('offline'));
      await Promise.resolve();
      await Promise.resolve();
      await flush();
    });

    // La intención en cola se reconstruye sobre los ajustes confirmados: el
    // cambio de brazo que falló no se reenvía como si siguiera vigente.
    expect(mocks.saveSettings).toHaveBeenCalledTimes(2);
    expect(mocks.saveSettings).toHaveBeenLastCalledWith(expect.objectContaining({
      patientName: 'Nuevo',
      defaultArm: 'left',
    }));
    expect(appState('arm')).toBe('left');
    expect(patientNameInput().value).toBe('Nuevo');
  });

  it('refleja en vivo los ajustes confirmados desde otra vista (sin borrador)', async () => {
    await renderApp();
    await openSettings();
    await clickButton('Brazo Derecho');
    await flush();

    // El modal no guarda un estado propio: muestra los ajustes confirmados.
    expect(patientNameInput().value).toBe('Real');
    await setPatientName('Cambiado');
    await flush();
    expect(appState('patient-name')).toBe('Cambiado');
    expect(patientNameInput().value).toBe('Cambiado');
  });
});

describe('Cambio de medicación', () => {
  it('avisa y cierra el diálogo cuando el guardado sin recálculo no se confirma', async () => {
    mocks.fetchSettings.mockResolvedValue(userSettings({ takesAntihypertensiveMedication: false }));
    mocks.saveSettings.mockRejectedValue(new Error('offline'));

    await renderApp();
    await openSettings();
    await clickButton('SÍ toma');
    expect(medicationDialogOpen()).toBe(true);
    await clickButton('Conservar');
    await flush();

    expect(container.textContent).toContain('No se pudo actualizar el contexto de medicación');
    // Un único aviso: no se duplica con el genérico de ajustes.
    expect(container.textContent).not.toContain('No se pudieron guardar los ajustes');
    // Sin diálogo colgado y con la medicación revertida a lo confirmado.
    expect(medicationDialogOpen()).toBe(false);
    expect(appState('medication')).toBe('false');
    expect(isActive('NO toma')).toBe(true);
  });

  it('avisa y cierra el diálogo cuando el recálculo no se confirma (simetría)', async () => {
    mocks.fetchSettings.mockResolvedValue(userSettings({ takesAntihypertensiveMedication: false }));
    mocks.updateMedication.mockRejectedValue(new Error('offline'));

    await renderApp();
    await openSettings();
    await clickButton('SÍ toma');
    await clickButton('Recalcular');
    await flush();

    expect(mocks.saveSettings).not.toHaveBeenCalled();
    expect(container.textContent).toContain('No se pudo actualizar el contexto de medicación');
    expect(medicationDialogOpen()).toBe(false);
    expect(appState('medication')).toBe('false');
    expect(isActive('NO toma')).toBe(true);
  });

  it('el recálculo confirmado propaga la medicación a las mediciones y al estado', async () => {
    mocks.fetchSettings.mockResolvedValue(userSettings({ takesAntihypertensiveMedication: false }));

    await renderApp();
    await openSettings();
    await clickButton('SÍ toma');
    await clickButton('Recalcular');
    await flush();

    expect(mocks.updateMedication).toHaveBeenCalledWith(true);
    expect(appState('medication')).toBe('true');
    expect(appState('readings-medication')).toBe('true');
    expect(medicationDialogOpen()).toBe(false);
    expect(container.textContent).not.toContain('No se pudo actualizar el contexto de medicación');
  });

  it('no descarta el recálculo por un guardado de ajustes posterior', async () => {
    mocks.fetchSettings.mockResolvedValue(userSettings({ takesAntihypertensiveMedication: false, patientName: 'Real' }));
    let resolveSave!: () => void;
    mocks.saveSettings.mockReturnValueOnce(new Promise<void>((resolve) => { resolveSave = resolve; }));

    await renderApp();
    await openSettings();
    await clickButton('Brazo Derecho');
    await clickButton('SÍ toma');
    await clickButton('Recalcular');
    await flush();

    // El recálculo espera a la escritura en curso en lugar de descartarse.
    expect(mocks.updateMedication).not.toHaveBeenCalled();

    await act(async () => {
      resolveSave();
      await Promise.resolve();
      await Promise.resolve();
      await flush();
    });

    expect(mocks.updateMedication).toHaveBeenCalledWith(true);
    expect(appState('medication')).toBe('true');

    // Un guardado posterior conserva la medicación ya confirmada.
    await clickButton('Brazo Izquierdo');
    await flush();
    expect(mocks.saveSettings).toHaveBeenLastCalledWith(expect.objectContaining({
      patientName: 'Real',
      defaultArm: 'left',
      takesAntihypertensiveMedication: true,
    }));
    expect(appState('medication')).toBe('true');
  });
});

describe('Cambio de contexto: restauración, cierre e invalidación de sesión', () => {
  it('una restauración descarta el guardado en vuelo y no reaplica los valores anteriores', async () => {
    mocks.parseBackupContent.mockReturnValue({
      status: 'valid',
      snapshot: { format: 'cta-elrocho-backup', version: 1, createdAt: '2026-10-01T00:00:00.000Z', readings: [], settings: userSettings() },
    });
    mocks.restoreBackup.mockResolvedValue({
      readings: [],
      settings: userSettings({ patientName: 'Restaurado', defaultArm: 'left' }),
    });
    vi.stubGlobal('FileReader', StubReader);

    let resolveInflight!: () => void;
    mocks.saveSettings.mockReturnValueOnce(new Promise<void>((resolve) => { resolveInflight = resolve; }));

    await renderApp();
    await openSettings();
    await clickButton('Brazo Derecho');
    expect(appState('arm')).toBe('right');
    // Una segunda intención espera en la cola detrás de la que está en vuelo.
    await setPatientName('Cambio pendiente');

    await restoreFromFile();

    // El contexto es otro: los ajustes restaurados son los confirmados.
    expect(appState('patient-name')).toBe('Restaurado');
    expect(appState('arm')).toBe('left');
    expect(patientNameInput().value).toBe('Restaurado');

    // La respuesta tardía no reaplica los valores anteriores ni avisa, y la
    // intención que esperaba en la cola se descarta sin enviarse.
    await act(async () => {
      resolveInflight();
      await Promise.resolve();
      await Promise.resolve();
      await flush();
    });

    expect(mocks.saveSettings).toHaveBeenCalledTimes(1);
    expect(appState('patient-name')).toBe('Restaurado');
    expect(appState('arm')).toBe('left');
    expect(patientNameInput().value).toBe('Restaurado');
    expect(container.textContent).not.toContain('No se pudieron guardar los ajustes');

    // Un cambio nuevo usa los ajustes del contexto nuevo.
    await clickButton('Brazo Derecho');
    await flush();
    expect(mocks.saveSettings).toHaveBeenLastCalledWith(expect.objectContaining({
      patientName: 'Restaurado',
      defaultArm: 'right',
    }));
  });

  it('no reaplica el guardado en vuelo del usuario anterior tras invalidarse la sesión', async () => {
    let resolveInflight!: () => void;
    mocks.saveSettings.mockReturnValueOnce(new Promise<void>((resolve) => { resolveInflight = resolve; }));
    mocks.fetchSettings
      .mockResolvedValueOnce(userSettings({ patientName: 'userA-name' }))
      .mockResolvedValueOnce(userSettings({ patientName: 'userB-name' }));

    await renderApp();
    await openSettings();
    await setPatientName('userA-edited');

    await act(async () => {
      notifySessionInvalid(false);
      await Promise.resolve();
    });
    // El modal de la sesión invalidada no puede quedar abierto.
    expect(settingsModalOpen()).toBe(false);

    await clickButton('login-user-b');
    await flush();
    await openSettings();
    expect(patientNameInput().value).toBe('userB-name');

    await act(async () => {
      resolveInflight();
      await Promise.resolve();
      await Promise.resolve();
      await flush();
    });

    expect(patientNameInput().value).toBe('userB-name');
    expect(appState('patient-name')).toBe('userB-name');

    await clickButton('Brazo Derecho');
    await flush();
    expect(mocks.saveSettings).toHaveBeenLastCalledWith(expect.objectContaining({
      patientName: 'userB-name',
      defaultArm: 'right',
    }));
    // El único guardado con los datos de A es el legítimo de su propia sesión:
    // nada de A se reenvía después del cambio de usuario.
    const writesWithUserAData = mocks.saveSettings.mock.calls.filter((call) => {
      const payload = call[0] as AppSettings;
      return payload.patientName === 'userA-edited' || payload.patientName === 'userA-name';
    });
    expect(writesWithUserAData).toHaveLength(1);
    expect(patientNameInput().value).toBe('userB-name');
  });

  it('mantiene los escritores inactivos tras cerrar sesión y los reactiva con la carga del usuario nuevo', async () => {
    await renderApp();
    await openSettings();
    await setPatientName('Cambio de A');
    await flush();
    const writesBeforeLogout = mocks.saveSettings.mock.calls.length;

    await clickButton('logout');
    await flush();
    expect(settingsModalOpen()).toBe(false);

    // Sin sesión no hay ajustes cargados: el modo de entrada no puede escribir.
    await clickButton('Teclado');
    await flush();
    expect(mocks.saveSettings.mock.calls.length).toBe(writesBeforeLogout);
    expect(container.textContent).toContain('Tus ajustes aún no están disponibles');

    // Con la sesión nueva y sus ajustes cargados, vuelve a guardarse.
    await clickButton('login-user-b');
    await flush();
    await clickButton('Teclado');
    await flush();
    expect(mocks.saveSettings).toHaveBeenLastCalledWith(expect.objectContaining({
      patientName: 'Real',
      preferredInputMode: 'wheel',
    }));
  });
});

// Defecto 1: una intención PARCIAL coalescable (medicación sin recálculo) que un
// guardado completo posterior absorbe desaparecía del libro de confirmados: el
// payload enviado sí llevaba su cambio, pero `confirmedSettingsRef` no lo
// registraba, de modo que un rechazo posterior revertía la UI a un valor que ya
// no coincidía con el servidor.
describe('Defecto 1: la intención parcial coalescida queda registrada como confirmada', () => {
  it('una medicación absorbida por un guardado completo se confirma y no se revierte de más', async () => {
    mocks.fetchSettings.mockResolvedValue(userSettings({ takesAntihypertensiveMedication: false }));
    let resolveInflight!: () => void;
    mocks.saveSettings
      .mockReturnValueOnce(new Promise<void>((resolve) => { resolveInflight = resolve; })) // write1 (brazo)
      .mockResolvedValueOnce(undefined) // write3 (absorbe la medicación)
      .mockRejectedValueOnce(new Error('offline')); // write4 (fallo posterior)

    await renderApp();
    await openSettings();
    await clickButton('Brazo Derecho'); // write1 en vuelo
    await clickButton('SÍ toma');
    await clickButton('Conservar'); // write2 {med:true} coalescable, queda pendiente
    await clickButton('Brazo Izquierdo'); // write3 la absorbe (changes fusionados)

    expect(mocks.saveSettings).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveInflight();
      await Promise.resolve();
      await Promise.resolve();
      await flush();
    });

    // El guardado completo se envió con la medicación absorbida...
    expect(mocks.saveSettings).toHaveBeenLastCalledWith(expect.objectContaining({
      defaultArm: 'left',
      takesAntihypertensiveMedication: true,
    }));
    expect(appState('medication')).toBe('true');

    // ...y un rechazo posterior revierte al valor confirmado (true), no al previo.
    await clickButton('Brazo Derecho');
    await flush();
    expect(container.textContent).toContain('No se pudieron guardar los ajustes');
    expect(appState('medication')).toBe('true');
  });
});

// Defecto 2: una petición de ajustes que nunca resuelve bloqueaba la cola de un
// solo vuelo para siempre, de modo que tras el cierre o la invalidación de
// sesión las escrituras del usuario siguiente quedaban pendientes sin enviarse
// ni avisar.
describe('Defecto 2: una escritura colgada no bloquea la cola de la sesión siguiente', () => {
  it('libera el turno al invalidarse la sesión y permite escribir al usuario siguiente sin resolver la petición colgada', async () => {
    mocks.saveSettings.mockReturnValueOnce(new Promise<void>(() => {})); // nunca resuelve
    mocks.fetchSettings
      .mockResolvedValueOnce(userSettings({ patientName: 'userA-name' }))
      .mockResolvedValueOnce(userSettings({ patientName: 'userB-name' }));

    await renderApp();
    await openSettings();
    await setPatientName('userA-edited'); // write1 colgado en vuelo

    await act(async () => {
      notifySessionInvalid(false);
      await Promise.resolve();
    });

    await clickButton('login-user-b');
    await flush();
    await openSettings();
    expect(patientNameInput().value).toBe('userB-name');

    // Sin resolver la petición de A, la escritura de B se envía (el turno se liberó).
    await clickButton('Brazo Derecho');
    await flush();
    expect(mocks.saveSettings).toHaveBeenLastCalledWith(expect.objectContaining({
      patientName: 'userB-name',
      defaultArm: 'right',
    }));
    expect(appState('arm')).toBe('right');
  });

  it('abandona una petición colgada al agotarse el plazo, avisa y libera la cola', async () => {
    mocks.saveSettings.mockReturnValueOnce(new Promise<void>(() => {})); // nunca resuelve

    await act(async () => {
      root.render(<App settingsWriteTimeoutMs={30} />);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    await flush();

    await openSettings();
    await setPatientName('Colgado');
    expect(mocks.saveSettings).toHaveBeenCalledTimes(1);

    // Se agota el plazo: se avisa (en lugar de dar el cambio por guardado).
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
    await flush();
    expect(container.textContent).toContain('No se pudieron guardar los ajustes');
    expect(appState('patient-name')).toBe('Real');

    // El turno queda libre: el siguiente cambio se envía.
    await clickButton('Brazo Derecho');
    await flush();
    expect(mocks.saveSettings).toHaveBeenCalledTimes(2);
    expect(mocks.saveSettings).toHaveBeenLastCalledWith(expect.objectContaining({ defaultArm: 'right' }));
  });

  it('avisa cuando descarta una escritura pendiente al cerrar la sesión', async () => {
    mocks.saveSettings.mockReturnValueOnce(new Promise<void>(() => {})); // nunca resuelve

    await renderApp();
    await openSettings();
    await setPatientName('A-edited');

    await clickButton('logout');
    await flush();

    expect(container.textContent).toContain('Se descartó un cambio de ajustes pendiente');
    expect(settingsModalOpen()).toBe(false);
  });
});

// Defecto 3: el estado de modal ligado a la sesión (lectura en edición) no se
// limpiaba al cerrar, invalidar o cambiar de usuario: el modal del usuario
// anterior quedaba visible sobre el acceso con sus valores.
describe('Defecto 3: el estado de modal ligado a la sesión se limpia', () => {
  it('cierra el modal de edición al invalidarse la sesión (no queda sobre el acceso)', async () => {
    await renderApp();
    await clickButton('edit-reading');
    expect(container.querySelector('.edit-reading-modal')).not.toBeNull();

    await act(async () => {
      notifySessionInvalid(false);
      await Promise.resolve();
    });

    expect(container.querySelector('.edit-reading-modal')).toBeNull();
    expect(container.querySelector('#edit-systolic')).toBeNull();
  });

  it('cierra el modal de edición al cerrar sesión', async () => {
    await renderApp();
    await clickButton('edit-reading');
    expect(container.querySelector('.edit-reading-modal')).not.toBeNull();

    await clickButton('logout');
    await flush();

    expect(container.querySelector('.edit-reading-modal')).toBeNull();
  });

  it('limpia el modal de edición al acceder con otro usuario', async () => {
    mocks.fetchSettings
      .mockResolvedValueOnce(userSettings({ patientName: 'userA-name' }))
      .mockResolvedValueOnce(userSettings({ patientName: 'userB-name' }));

    await renderApp();
    await clickButton('edit-reading'); // modal de A abierto

    await act(async () => {
      notifySessionInvalid(false);
      await Promise.resolve();
    });

    // Antes de acceder, un modal de edición puede volver a abrirse...
    await clickButton('edit-reading');
    expect(container.querySelector('.edit-reading-modal')).not.toBeNull();

    // ...y el acceso correcto limpia el estado de la sesión anterior.
    await clickButton('login-user-b');
    await flush();
    expect(container.querySelector('.edit-reading-modal')).toBeNull();
  });
});

// Cobertura de mutaciones: cada prueba falla si se introduce el defecto descrito.
describe('Regresión de mutaciones del modelo de ajustes', () => {
  it('M1: no inicia una escritura de medicación mientras los ajustes no están cargados', async () => {
    mocks.getAuthStatus.mockResolvedValue({ hasAdmin: true, user: null });
    mocks.fetchSettings.mockReturnValueOnce(new Promise<AppSettings>(() => {})); // carga en vuelo

    await renderApp();
    await clickButton('login-user-a');
    await flush();

    await openSettings();
    await clickButton('SÍ toma');
    await clickButton('Conservar');
    await flush();

    expect(mocks.saveSettings).not.toHaveBeenCalled();
    expect(mocks.updateMedication).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Tus ajustes aún no están disponibles');
    expect(medicationDialogOpen()).toBe(false);
  });

  it('M2: un recálculo fallido no propaga la medicación a las mediciones', async () => {
    mocks.fetchReadings.mockResolvedValue([{ ...mocks.reading, takesAntihypertensiveMedication: false }]);
    mocks.fetchSettings.mockResolvedValue(userSettings({ takesAntihypertensiveMedication: false }));
    mocks.updateMedication.mockRejectedValue(new Error('offline'));

    await renderApp();
    await openSettings();
    await clickButton('SÍ toma');
    await clickButton('Recalcular');
    await flush();

    expect(container.textContent).toContain('No se pudo actualizar el contexto de medicación');
    expect(appState('medication')).toBe('false');
    // onConfirmed solo corre en el éxito: las mediciones no se tocan al fallar.
    expect(appState('readings-medication')).toBe('false');
  });

  it('M3: al fallar una intención se conserva el cambio optimista de la que espera en la cola', async () => {
    let rejectInflight!: (error: Error) => void;
    mocks.saveSettings
      .mockReturnValueOnce(new Promise<void>((_resolve, reject) => { rejectInflight = reject; })) // write1 fallará
      .mockReturnValueOnce(new Promise<void>(() => {})); // write2 queda colgada

    await renderApp();
    await openSettings();
    await clickButton('Brazo Derecho'); // write1 en vuelo
    await setPatientName('Nuevo'); // write2 pendiente

    await act(async () => {
      rejectInflight(new Error('offline'));
      await Promise.resolve();
      await Promise.resolve();
      await flush();
    });

    // La intención pendiente sigue visible; la que falló se revierte.
    expect(appState('patient-name')).toBe('Nuevo');
    expect(appState('arm')).toBe('left');
    expect(patientNameInput().value).toBe('Nuevo');
  });

  it('M4: el éxito de una intención no pisa el cambio optimista de la que sigue en cola', async () => {
    let resolveInflight!: () => void;
    mocks.saveSettings
      .mockReturnValueOnce(new Promise<void>((resolve) => { resolveInflight = resolve; })) // write1 éxito
      .mockReturnValueOnce(new Promise<void>(() => {})); // write2 colgada

    await renderApp();
    await openSettings();
    await clickButton('Brazo Derecho'); // write1 en vuelo
    await setPatientName('Nuevo'); // write2 pendiente

    await act(async () => {
      resolveInflight();
      await Promise.resolve();
      await Promise.resolve();
      await flush();
    });

    // El éxito no re-base sobre el libro confirmado: conserva lo que sigue visible.
    expect(appState('patient-name')).toBe('Nuevo');
    expect(appState('arm')).toBe('right');
  });

  it('M5: el libro de confirmados solo avanza con el delta aceptado, no con lo aún no confirmado', async () => {
    let resolveInflight!: () => void;
    mocks.saveSettings
      .mockReturnValueOnce(new Promise<void>((resolve) => { resolveInflight = resolve; })) // write1 éxito
      .mockRejectedValueOnce(new Error('offline')); // write2 fallará

    await renderApp();
    await openSettings();
    await clickButton('Brazo Derecho'); // write1 en vuelo
    await setPatientName('Nuevo'); // write2 pendiente

    await act(async () => {
      resolveInflight();
      await Promise.resolve();
      await Promise.resolve();
      await flush();
    });

    // write2 falló: se revierte a lo confirmado, que NO incluía su cambio.
    expect(container.textContent).toContain('No se pudieron guardar los ajustes');
    expect(appState('patient-name')).toBe('Real');
    expect(appState('arm')).toBe('right');
  });

  it('M6: una intención descartada por cambio de contexto resuelve su promesa', async () => {
    mocks.parseBackupContent.mockReturnValue({
      status: 'valid',
      snapshot: { format: 'cta-elrocho-backup', version: 1, createdAt: '2026-10-01T00:00:00.000Z', readings: [], settings: userSettings() },
    });
    mocks.restoreBackup.mockResolvedValue({ readings: [], settings: userSettings({ patientName: 'Restaurado' }) });
    vi.stubGlobal('FileReader', StubReader);
    mocks.saveSettings.mockReturnValueOnce(new Promise<void>(() => {})); // write1 colgada

    await renderApp();
    await openSettings();
    await clickButton('Brazo Derecho'); // write1 en vuelo
    await clickButton('SÍ toma');
    await clickButton('Recalcular'); // write2 pendiente (recálculo), confirmación en curso
    expect(medicationDialogOpen()).toBe(true);

    await restoreFromFile();

    // El descarte resolvió la intención: el diálogo se cierra en vez de quedar
    // colgado esperando una respuesta que ya no pertenece a este contexto.
    expect(medicationDialogOpen()).toBe(false);
  });
});

// Defecto 4: al agotarse el plazo de una escritura el cliente la daba por
// rechazada y afirmaba que no se había guardado, aunque la petición abandonada
// pudiera completarse después en el servidor. La reparación relee el servidor
// (solo lectura, en silencio si falla) y toma como confirmado lo que devuelva.
describe('Defecto 4: la escritura abandonada por plazo se reconcilia releyendo el servidor', () => {
  it('no afirma que no se guardó si la relectura muestra que el cambio sí se aplicó', async () => {
    mocks.saveSettings.mockReturnValueOnce(new Promise<void>(() => {})); // nunca resuelve: se agota el plazo
    mocks.fetchSettings
      .mockResolvedValueOnce(userSettings({ patientName: 'Real' })) // carga inicial
      .mockResolvedValueOnce(userSettings({ patientName: 'Colgado' })); // la petición abandonada sí se aplicó

    await act(async () => {
      root.render(<App settingsWriteTimeoutMs={30} />);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    await flush();

    await openSettings();
    await setPatientName('Colgado');
    expect(mocks.saveSettings).toHaveBeenCalledTimes(1);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
    await flush();

    // La relectura de reconciliación recupera el cambio aplicado por la petición
    // abandonada: no se anuncia un fallo que no ocurrió y el estado lo refleja.
    expect(mocks.fetchSettings).toHaveBeenCalledTimes(2);
    expect(container.textContent).not.toContain('No se pudieron guardar los ajustes');
    expect(appState('patient-name')).toBe('Colgado');
    expect(patientNameInput().value).toBe('Colgado');
  });

  it('revierte y avisa cuando la relectura tras el plazo no incluye el cambio', async () => {
    mocks.saveSettings.mockReturnValueOnce(new Promise<void>(() => {})); // nunca resuelve
    mocks.fetchSettings
      .mockResolvedValueOnce(userSettings({ patientName: 'Real' })) // carga inicial
      .mockResolvedValueOnce(userSettings({ patientName: 'Real' })); // la relectura no trae el cambio

    await act(async () => {
      root.render(<App settingsWriteTimeoutMs={30} />);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    await flush();

    await openSettings();
    await setPatientName('Colgado');

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
    await flush();

    expect(mocks.fetchSettings).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('No se pudieron guardar los ajustes');
    expect(appState('patient-name')).toBe('Real');
  });

  it('mantiene la reversión silenciosa cuando falla la propia relectura', async () => {
    mocks.saveSettings.mockReturnValueOnce(new Promise<void>(() => {})); // nunca resuelve
    mocks.fetchSettings
      .mockResolvedValueOnce(userSettings({ patientName: 'Real' })) // carga inicial
      .mockRejectedValueOnce(new Error('offline')); // la relectura de reconciliación falla

    await act(async () => {
      root.render(<App settingsWriteTimeoutMs={30} />);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    await flush();

    await openSettings();
    await setPatientName('Colgado');

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
    await flush();

    // Sin relectura disponible se aplica la reversión con aviso de siempre.
    expect(container.textContent).toContain('No se pudieron guardar los ajustes');
    expect(appState('patient-name')).toBe('Real');
  });
});

// Confirmar la copia ya queda reflejado dentro del propio modal mediante la
// fecha de «Última copia confirmada». App solo debe persistir los timestamps y
// cerrar la confirmación; un segundo toast positivo duplica la confirmación.
describe('Confirmación de copia manual sin segundo toast positivo', () => {
  it('persiste ambos timestamps y cierra la confirmación sin mostrar otro éxito', async () => {
    await renderApp();

    await openExportModal();
    await clickButton('Crear una copia (JSON)');
    await clickButton('Confirmar copia guardada');
    await flush();

    expect(mocks.saveSettings).toHaveBeenCalledWith(expect.objectContaining({
      lastBackupTimestamp: expect.any(String),
      lastFullBackupTimestamp: expect.any(String),
    }));
    expect(container.textContent).not.toContain('Copia confirmada. Se ha actualizado la fecha del recordatorio.');
    expect(container.querySelector('.toast-notification')).toBeNull();
  });

  it('mantiene el aviso de error si falla el guardado de los timestamps', async () => {
    mocks.saveSettings.mockRejectedValueOnce(new Error('offline'));
    await renderApp();

    await openExportModal();
    await clickButton('Crear una copia (JSON)');
    await clickButton('Confirmar copia guardada');
    await flush();

    expect(mocks.saveSettings).toHaveBeenCalledWith(expect.objectContaining({
      lastBackupTimestamp: expect.any(String),
      lastFullBackupTimestamp: expect.any(String),
    }));
    expect(container.textContent).toContain('No se pudieron guardar los ajustes');
    expect(container.textContent).not.toContain('Copia confirmada. Se ha actualizado la fecha del recordatorio.');
  });

  it('no muestra otro éxito aunque el guardado de la copia se absorba en otro guardado completo', async () => {
    let resolveInflight!: () => void;
    mocks.saveSettings
      .mockReturnValueOnce(new Promise<void>((resolve) => { resolveInflight = resolve; })) // write1 en vuelo
      .mockResolvedValueOnce(undefined); // write3, que absorbe la intención de la copia

    await renderApp();

    // Una escritura de ajustes queda en vuelo.
    await openSettings();
    await clickButton('Brazo Derecho');

    // Se crea la copia manual y se confirma: su escritura (timestamps) queda
    // pendiente detrás de la que está en vuelo.
    await openExportModal();
    await clickButton('Crear una copia (JSON)');
    await clickButton('Confirmar copia guardada');
    await flush();

    // Otra intención de guardado completo absorbe la de la copia.
    await clickButton('Brazo Izquierdo');
    expect(mocks.saveSettings).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveInflight();
      await Promise.resolve();
      await Promise.resolve();
      await flush();
    });

    // Los timestamps de la copia viajaron dentro del payload aceptado...
    expect(mocks.saveSettings).toHaveBeenLastCalledWith(expect.objectContaining({
      defaultArm: 'left',
      lastBackupTimestamp: expect.any(String),
      lastFullBackupTimestamp: expect.any(String),
    }));
    // ...pero la confirmación ya se cerró y no aparece un segundo toast positivo.
    expect(container.textContent).not.toContain('Copia confirmada. Se ha actualizado la fecha del recordatorio.');
    expect(container.querySelector('.toast-notification')).toBeNull();
  });
});

// Defecto 6: un aviso transitorio (por ejemplo el de descarte o el de error de
// guardado) sobrevivía sobre la pantalla de acceso al cambiar de sesión.
describe('Defecto 6: el aviso transitorio se limpia al cambiar el contexto de sesión', () => {
  it('no deja el aviso de la sesión anterior sobre la pantalla de acceso', async () => {
    mocks.saveSettings.mockRejectedValueOnce(new Error('offline'));

    await renderApp();
    await openSettings();
    await setPatientName('Fallido');
    await flush();
    expect(container.textContent).toContain('No se pudieron guardar los ajustes');

    await clickButton('logout');
    await flush();

    // La pantalla de acceso aparece sin arrastrar el aviso de la sesión cerrada.
    expect(hasButton('login-user-a')).toBe(true);
    expect(container.textContent).not.toContain('No se pudieron guardar los ajustes');
    expect(container.querySelector('.toast-notification')).toBeNull();
  });
});

// Defecto 7: el formulario de medición permanece montado entre sesiones y
// conservaba los valores tecleados y la confirmación de presión de pulso del
// usuario anterior.
describe('Defecto 7: los valores de formulario ligados a la sesión se reinician', () => {
  it('reinicia los valores tecleados y la confirmación de presión de pulso al cambiar de sesión', async () => {
    mocks.fetchSettings
      .mockResolvedValueOnce(userSettings({ patientName: 'userA-name' }))
      .mockResolvedValueOnce(userSettings({ patientName: 'userB-name' }));

    await renderApp();

    await act(async () => {
      setNativeValue(readingInput('#systolic-input'), '160');
      setNativeValue(readingInput('#diastolic-input'), '90');
      setNativeValue(readingInput('#pulse-input'), '60');
      setNativeValue(readingInput('.input-notes'), 'Nota del paciente A');
      await Promise.resolve();
    });
    // La presión de pulso (160-90=70) pide confirmación y queda en pantalla.
    await submitReadingForm();
    await flush();
    expect(document.body.querySelector('.pulse-pressure-dialog')).not.toBeNull();

    // Cambia la sesión (invalidación y acceso del usuario siguiente).
    await act(async () => {
      notifySessionInvalid(false);
      await Promise.resolve();
    });
    await clickButton('login-user-b');
    await flush();

    // El formulario del usuario nuevo arranca vacío y sin
    // la confirmación pendiente del anterior.
    expect(readingInput('#systolic-input').value).toBe('');
    expect(readingInput('#diastolic-input').value).toBe('');
    expect(readingInput('#pulse-input').value).toBe('');
    expect(readingInput('.input-notes').value).toBe('');
    expect(document.body.querySelector('.pulse-pressure-dialog')).toBeNull();
  });
});
