import type { BloodPressureReading, AppSettings } from '../types/bloodPressure';
import type { AppBackupSnapshot } from '../utils/backupService';
import { guardUnauthorized } from './sessionGuard';

let freshRequestSequence = 0;

function freshApiUrl(path: string): string {
  freshRequestSequence += 1;
  return `${path}?fresh=${Date.now()}-${freshRequestSequence}`;
}

export type StorageErrorCode =
  | 'network'
  | 'http'
  | 'invalid-response'
  | 'session-token-required'
  | 'merge-preview-stale';

export class StorageRequestError extends Error {
  readonly code: StorageErrorCode;
  readonly status?: number;

  constructor(code: StorageErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'StorageRequestError';
    this.code = code;
    this.status = status;
  }
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'es',
  enableWhiteCoatFilter: false,
  whiteCoatIntervalMinutes: 5,
  defaultArm: 'left',
  preferredInputMode: 'keyboard',
  guidelineProfile: 'esc-2024',
  showInformationalLabels: false,
  treatmentTargetMode: 'guideline',
  customTargetSystolicMin: 120,
  customTargetSystolicMax: 129,
  customTargetDiastolicMin: 70,
  customTargetDiastolicMax: 79,
  patientName: '',
  patientSex: '',
  patientAge: '',
  takesAntihypertensiveMedication: false,
  backupFrequency: 'disabled',
  backupFolder: 'Descargas/Copias_Tension_Arterial',
  lastBackupTimestamp: undefined,
  lastFullBackupTimestamp: undefined,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isReading(value: unknown): value is BloodPressureReading {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.timestamp === 'string'
    && typeof value.systolic === 'number'
    && typeof value.diastolic === 'number'
    && typeof value.heartRate === 'number'
    && (value.arm === 'left' || value.arm === 'right');
}

function isSettingsPayload(value: unknown): value is AppSettings {
  if (!isRecord(value)) return false;
  return (value.language === 'es' || value.language === 'en')
    && typeof value.enableWhiteCoatFilter === 'boolean'
    && value.whiteCoatIntervalMinutes === 5
    && (value.defaultArm === 'left' || value.defaultArm === 'right')
    && (value.preferredInputMode === 'keyboard' || value.preferredInputMode === 'wheel')
    && (value.guidelineProfile === 'esc-2024' || value.guidelineProfile === 'aha-acc-2025' || value.guidelineProfile === 'ish-2020')
    && typeof value.showInformationalLabels === 'boolean'
    && (value.treatmentTargetMode === 'guideline' || value.treatmentTargetMode === 'custom')
    && typeof value.customTargetSystolicMin === 'number'
    && typeof value.customTargetSystolicMax === 'number'
    && typeof value.customTargetDiastolicMin === 'number'
    && typeof value.customTargetDiastolicMax === 'number'
    && typeof value.takesAntihypertensiveMedication === 'boolean'
    && (value.backupFrequency === 'disabled' || value.backupFrequency === 'daily' || value.backupFrequency === 'weekly' || value.backupFrequency === 'monthly')
    && typeof value.backupFolder === 'string';
}

function invalidResponse(message: string): StorageRequestError {
  return new StorageRequestError('invalid-response', message);
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch (cause) {
    throw new StorageRequestError('network', cause instanceof Error ? cause.message : 'No se pudo conectar con el servidor');
  }
  guardUnauthorized(response);
  if (!response.ok) {
    throw new StorageRequestError('http', `La operación de almacenamiento falló (${response.status})`, response.status);
  }
  return response;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new StorageRequestError('invalid-response', 'El servidor devolvió una respuesta no válida', response.status);
  }
}

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  return readJson(await request(path, init));
}

async function requestConfirmed(path: string, init?: RequestInit): Promise<void> {
  const data = await requestJson(path, init);
  if (!isRecord(data) || data.success !== true) throw invalidResponse('El servidor no confirmó la operación');
}

export async function fetchReadingsFromServer(): Promise<BloodPressureReading[]> {
  const data = await requestJson(freshApiUrl('/api/readings'), { credentials: 'include', cache: 'no-store' });
  if (!Array.isArray(data) || !data.every(isReading)) throw invalidResponse('La lista de mediciones no es válida');
  return data;
}

export async function addReadingToServer(newReading: Omit<BloodPressureReading, 'id'>): Promise<BloodPressureReading> {
  const data = await requestJson('/api/readings', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(newReading),
  });
  if (!isReading(data)) throw invalidResponse('La medición creada no es válida');
  return data;
}

export async function updateReadingOnServer(updatedReading: BloodPressureReading): Promise<void> {
  const data = await requestJson(`/api/readings/${updatedReading.id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(updatedReading),
  });
  if (!isReading(data)) throw invalidResponse('La medición actualizada no es válida');
}

export async function updateMedicationContextForAllReadings(takesAntihypertensiveMedication: boolean): Promise<void> {
  await requestConfirmed('/api/readings/medication-context', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ takesAntihypertensiveMedication }),
  });
}

export async function deleteReadingFromServer(id: string): Promise<void> {
  await requestConfirmed(`/api/readings/${id}`, { method: 'DELETE', credentials: 'include' });
}

export async function deleteSessionFromServer(readingIds: string[]): Promise<void> {
  await requestConfirmed('/api/sessions/delete', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ readingIds }),
  });
}

export async function clearAllReadingsOnServer(): Promise<void> {
  await requestConfirmed('/api/readings/all/confirm', { method: 'DELETE', credentials: 'include' });
}

export async function resetDemoDataOnServer(): Promise<BloodPressureReading[]> {
  const data = await requestJson('/api/readings/reset-demo', { method: 'POST', credentials: 'include' });
  if (!Array.isArray(data) || !data.every(isReading)) throw invalidResponse('Las mediciones de demostración no son válidas');
  return data;
}

function getRestoreSessionToken(): string {
  const token = localStorage.getItem('cta_session_token');
  if (!token) throw new StorageRequestError('session-token-required', 'SESSION_TOKEN_REQUIRED');
  return token;
}

export async function importReadingsToServer(imported: Omit<BloodPressureReading, 'id'>[]): Promise<{ addedCount: number; readings: BloodPressureReading[] }> {
  const data = await requestJson('/api/readings/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-session-token': getRestoreSessionToken() },
    credentials: 'include', body: JSON.stringify(imported),
  });
  if (!isRecord(data) || typeof data.addedCount !== 'number' || !Array.isArray(data.readings) || !data.readings.every(isReading)) {
    throw invalidResponse('El resultado de la importación no es válido');
  }
  return { addedCount: data.addedCount, readings: data.readings };
}

export interface BackupMergeCounts { addedCount: number; duplicateCount: number; conflictCount: number }
export interface BackupMergePreview extends BackupMergeCounts { previewToken: string }
export interface BackupMergeResult extends BackupMergeCounts { readings: BloodPressureReading[] }

async function sendBackupMerge(path: string, payload: unknown): Promise<unknown> {
  const token = getRestoreSessionToken();
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'x-session-token': token },
      body: JSON.stringify(payload),
    });
  } catch (cause) {
    throw new StorageRequestError('network', cause instanceof Error ? cause.message : 'No se pudo conectar con el servidor');
  }
  guardUnauthorized(response);
  if (response.status === 409) throw new StorageRequestError('merge-preview-stale', 'MERGE_PREVIEW_STALE', 409);
  if (!response.ok) throw new StorageRequestError('http', `No se pudo combinar la copia (${response.status})`, response.status);
  return readJson(response);
}

function hasMergeCounts(value: unknown): value is Record<string, unknown> & BackupMergeCounts {
  return isRecord(value) && typeof value.addedCount === 'number' && typeof value.duplicateCount === 'number' && typeof value.conflictCount === 'number';
}

export async function previewBackupMergeOnServer(snapshot: AppBackupSnapshot): Promise<BackupMergePreview> {
  const data = await sendBackupMerge('/api/backups/merge-preview', snapshot);
  if (!hasMergeCounts(data) || typeof data.previewToken !== 'string') throw invalidResponse('La previsualización no es válida');
  return data as unknown as BackupMergePreview;
}

export async function mergeBackupOnServer(snapshot: AppBackupSnapshot, previewToken: string): Promise<BackupMergeResult> {
  const data = await sendBackupMerge('/api/backups/restore-merge', { snapshot, previewToken });
  if (!hasMergeCounts(data) || !Array.isArray(data.readings) || !data.readings.every(isReading)) throw invalidResponse('El resultado de la combinación no es válido');
  return data as unknown as BackupMergeResult;
}

export async function restoreBackupOnServer(snapshot: AppBackupSnapshot): Promise<{ readings: BloodPressureReading[]; settings: AppSettings }> {
  const data = await requestJson('/api/backups/restore-replace', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-session-token': getRestoreSessionToken() },
    credentials: 'include', body: JSON.stringify(snapshot),
  });
  if (!isRecord(data) || !Array.isArray(data.readings) || !isSettingsPayload(data.settings)) throw invalidResponse('El resultado de la restauración no es válido');
  return data as unknown as { readings: BloodPressureReading[]; settings: AppSettings };
}

export async function fetchSettingsFromServer(): Promise<AppSettings> {
  const data = await requestJson(freshApiUrl('/api/settings'), { credentials: 'include', cache: 'no-store' });
  if (!isSettingsPayload(data)) throw invalidResponse('Los ajustes no son válidos');
  return {
    ...DEFAULT_SETTINGS,
    ...data,
    showInformationalLabels: typeof data.showInformationalLabels === 'boolean' ? data.showInformationalLabels : true,
  };
}

export async function saveSettingsToServer(settings: AppSettings): Promise<void> {
  const data = await requestJson('/api/settings', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(settings),
  });
  if (!isRecord(data) || data.success !== true) throw invalidResponse('El servidor no confirmó los ajustes');
}
