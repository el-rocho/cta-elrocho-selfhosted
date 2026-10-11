import type { BloodPressureReading, AppSettings } from '../types/bloodPressure';
import type { AppBackupSnapshot } from '../utils/backupService';
import { guardUnauthorized } from './sessionGuard';

let freshRequestSequence = 0;

function freshApiUrl(path: string): string {
  freshRequestSequence += 1;
  return `${path}?fresh=${Date.now()}-${freshRequestSequence}`;
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'es',
  enableWhiteCoatFilter: false,
  whiteCoatIntervalMinutes: 5, // Valor fijo; se conserva en datos serializados por compatibilidad
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

export async function fetchReadingsFromServer(): Promise<BloodPressureReading[]> {
  try {
    const res = await fetch(freshApiUrl('/api/readings'), {
      credentials: 'include',
      cache: 'no-store',
    });
    guardUnauthorized(res);
    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    console.error('Error al consultar mediciones del servidor:', error);
    return [];
  }
}

export async function addReadingToServer(newReading: Omit<BloodPressureReading, 'id'>): Promise<BloodPressureReading | null> {
  try {
    const res = await fetch('/api/readings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(newReading),
    });
    guardUnauthorized(res);
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error('Error al guardar medición en el servidor:', error);
    return null;
  }
}

export async function updateReadingOnServer(updatedReading: BloodPressureReading): Promise<boolean> {
  try {
    const res = await fetch(`/api/readings/${updatedReading.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updatedReading),
    });
    guardUnauthorized(res);
    return res.ok;
  } catch (error) {
    console.error('Error al actualizar toma en el servidor:', error);
    return false;
  }
}

export async function updateMedicationContextForAllReadings(
  takesAntihypertensiveMedication: boolean
): Promise<boolean> {
  try {
    const res = await fetch('/api/readings/medication-context', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ takesAntihypertensiveMedication }),
    });
    guardUnauthorized(res);
    return res.ok;
  } catch (error) {
    console.error('Error al actualizar el contexto de medicación del historial:', error);
    return false;
  }
}

export async function deleteReadingFromServer(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/readings/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    guardUnauthorized(res);
    return res.ok;
  } catch (error) {
    console.error('Error al eliminar toma en el servidor:', error);
    return false;
  }
}

export async function deleteSessionFromServer(readingIds: string[]): Promise<boolean> {
  try {
    const res = await fetch('/api/sessions/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ readingIds }),
    });
    guardUnauthorized(res);
    return res.ok;
  } catch (error) {
    console.error('Error al eliminar sesión en el servidor:', error);
    return false;
  }
}

export async function clearAllReadingsOnServer(): Promise<boolean> {
  try {
    const res = await fetch('/api/readings/all/confirm', {
      method: 'DELETE',
      credentials: 'include',
    });
    guardUnauthorized(res);
    return res.ok;
  } catch (error) {
    console.error('Error al vaciar historial en el servidor:', error);
    return false;
  }
}

export async function resetDemoDataOnServer(): Promise<BloodPressureReading[]> {
  try {
    const res = await fetch('/api/readings/reset-demo', {
      method: 'POST',
      credentials: 'include',
    });
    guardUnauthorized(res);
    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    console.error('Error al restaurar mediciones de demostración en el servidor:', error);
    return [];
  }
}

function getRestoreSessionToken(): string {
  const token = localStorage.getItem('cta_session_token');
  if (!token) throw new Error('SESSION_TOKEN_REQUIRED');
  return token;
}

export async function importReadingsToServer(imported: Omit<BloodPressureReading, 'id'>[]): Promise<{ addedCount: number; readings: BloodPressureReading[] }> {
  const token = getRestoreSessionToken();
  const res = await fetch('/api/readings/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-session-token': token },
    credentials: 'include',
    body: JSON.stringify(imported),
  });
  guardUnauthorized(res);
  if (!res.ok) throw new Error(`No se pudo importar la copia (${res.status})`);
  const data = await res.json();
  return { addedCount: data.addedCount, readings: data.readings };
}

export async function restoreBackupOnServer(snapshot: AppBackupSnapshot): Promise<{
  readings: BloodPressureReading[];
  settings: AppSettings;
}> {
  const token = getRestoreSessionToken();
  const res = await fetch('/api/backups/restore-replace', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-session-token': token,
    },
    credentials: 'include',
    body: JSON.stringify(snapshot),
  });
  guardUnauthorized(res);
  if (!res.ok) throw new Error(`No se pudo restaurar la copia (${res.status})`);
  return await res.json();
}

export async function fetchSettingsFromServer(): Promise<AppSettings> {
  try {
    const res = await fetch(freshApiUrl('/api/settings'), {
      credentials: 'include',
      cache: 'no-store',
    });
    guardUnauthorized(res);
    if (!res.ok) return DEFAULT_SETTINGS;
    const data = await res.json();
    return {
      ...DEFAULT_SETTINGS,
      ...data,
      showInformationalLabels: typeof data.showInformationalLabels === 'boolean'
        ? data.showInformationalLabels
        : true,
    };
  } catch (error) {
    console.error('Error al consultar ajustes del servidor:', error);
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettingsToServer(settings: AppSettings): Promise<boolean> {
  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(settings),
    });
    guardUnauthorized(res);
    return res.ok;
  } catch (error) {
    console.error('Error al guardar ajustes en el servidor:', error);
    return false;
  }
}
