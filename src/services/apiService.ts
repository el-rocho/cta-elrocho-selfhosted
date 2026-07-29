import type { BloodPressureReading, AppSettings } from '../types/bloodPressure';

const API_BASE = '/api';

const INITIAL_DEMO_READINGS: BloodPressureReading[] = [
  {
    id: 'demo-100',
    timestamp: new Date().toISOString(),
    systolic: 120,
    diastolic: 80,
    heartRate: 72,
    arm: 'left',
    notes: 'Medición habitual de control',
  },
  {
    id: 'demo-5',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
    systolic: 124,
    diastolic: 81,
    heartRate: 70,
    arm: 'left',
    notes: 'Mañana en ayunas',
  },
  {
    id: 'demo-4',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    systolic: 118,
    diastolic: 78,
    heartRate: 69,
    arm: 'left',
    notes: 'Tras reposo',
  },
  {
    id: 'demo-3',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    systolic: 122,
    diastolic: 80,
    heartRate: 71,
    arm: 'right',
  },
  {
    id: 'demo-2',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    systolic: 126,
    diastolic: 82,
    heartRate: 73,
    arm: 'left',
  },
  {
    id: 'demo-1',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    systolic: 119,
    diastolic: 79,
    heartRate: 68,
    arm: 'left',
  },
];

export async function fetchReadingsAPI(): Promise<BloodPressureReading[]> {
  try {
    const res = await fetch(`${API_BASE}/readings`);
    if (!res.ok) throw new Error('Error de servidor al cargar lecturas');
    const data = await res.json();
    localStorage.setItem('server_bp_readings_cache', JSON.stringify(data));
    return data;
  } catch (error) {
    console.warn('Servidor local no alcanzable, usando almacenamiento en caché local:', error);
    const cached = localStorage.getItem('server_bp_readings_cache');
    return cached ? JSON.parse(cached) : INITIAL_DEMO_READINGS;
  }
}

export async function addReadingAPI(reading: Omit<BloodPressureReading, 'id'>): Promise<BloodPressureReading> {
  try {
    const res = await fetch(`${API_BASE}/readings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reading),
    });
    if (!res.ok) throw new Error('Error al guardar lectura en el servidor');
    return await res.json();
  } catch {
    const created: BloodPressureReading = {
      ...reading,
      id: `bp-local-${Date.now()}`,
    };
    const cached = localStorage.getItem('server_bp_readings_cache');
    const current = cached ? JSON.parse(cached) : INITIAL_DEMO_READINGS;
    const updated = [created, ...current];
    localStorage.setItem('server_bp_readings_cache', JSON.stringify(updated));
    return created;
  }
}

export async function deleteReadingAPI(id: string): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/readings/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Error al eliminar lectura en el servidor');
  } catch {
    const cached = localStorage.getItem('server_bp_readings_cache');
    if (cached) {
      const current: BloodPressureReading[] = JSON.parse(cached);
      const updated = current.filter((r) => r.id !== id);
      localStorage.setItem('server_bp_readings_cache', JSON.stringify(updated));
    }
  }
}

export async function deleteSessionAPI(readingIds: string[]): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/sessions/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ readingIds }),
    });
    if (!res.ok) throw new Error('Error al eliminar sesión en el servidor');
  } catch {
    const ids = new Set(readingIds);
    const cached = localStorage.getItem('server_bp_readings_cache');
    if (cached) {
      const current: BloodPressureReading[] = JSON.parse(cached);
      const updated = current.filter((r) => !ids.has(r.id));
      localStorage.setItem('server_bp_readings_cache', JSON.stringify(updated));
    }
  }
}

export async function clearAllDataAPI(): Promise<void> {
  try {
    await fetch(`${API_BASE}/readings/all/confirm`, {
      method: 'DELETE',
    });
  } catch (error) {
    console.warn('Servidor offline al borrar todo:', error);
  }
  localStorage.removeItem('server_bp_readings_cache');
}

export async function resetDemoDataAPI(): Promise<BloodPressureReading[]> {
  try {
    const res = await fetch(`${API_BASE}/readings/reset-demo`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Error al restaurar datos demo en el servidor');
    const data = await res.json();
    localStorage.setItem('server_bp_readings_cache', JSON.stringify(data));
    return data;
  } catch {
    localStorage.setItem('server_bp_readings_cache', JSON.stringify(INITIAL_DEMO_READINGS));
    return INITIAL_DEMO_READINGS;
  }
}

export async function importReadingsAPI(imported: Omit<BloodPressureReading, 'id'>[]): Promise<{ addedCount: number; readings: BloodPressureReading[] }> {
  try {
    const res = await fetch(`${API_BASE}/readings/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(imported),
    });
    if (!res.ok) throw new Error('Error al importar lecturas en el servidor');
    const result = await res.json();
    localStorage.setItem('server_bp_readings_cache', JSON.stringify(result.readings));
    return result;
  } catch {
    const cached = localStorage.getItem('server_bp_readings_cache');
    const current: BloodPressureReading[] = cached ? JSON.parse(cached) : INITIAL_DEMO_READINGS;
    let addedCount = 0;
    const newItems: BloodPressureReading[] = [];
    const existingSigs = new Set(current.map((r) => `${new Date(r.timestamp).toISOString().slice(0, 16)}_${r.systolic}_${r.diastolic}_${r.heartRate}`));
    imported.forEach((item) => {
      const sig = `${new Date(item.timestamp).toISOString().slice(0, 16)}_${item.systolic}_${item.diastolic}_${item.heartRate}`;
      if (!existingSigs.has(sig)) {
        existingSigs.add(sig);
        addedCount++;
        newItems.push({ ...item, id: `imp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}` });
      }
    });
    const updated = [...newItems, ...current];
    localStorage.setItem('server_bp_readings_cache', JSON.stringify(updated));
    return { addedCount, readings: updated };
  }
}

export async function fetchSettingsAPI(): Promise<AppSettings> {
  try {
    const res = await fetch(`${API_BASE}/settings`);
    if (!res.ok) throw new Error('Error de servidor al cargar ajustes');
    return await res.json();
  } catch {
    const cached = localStorage.getItem('server_bp_settings_cache');
    return cached ? JSON.parse(cached) : {
      enableWhiteCoatFilter: false,
      whiteCoatIntervalMinutes: 5,
      defaultArm: 'left',
      preferredInputMode: 'keyboard',
      patientName: '',
      patientSex: '',
      patientAge: '',
      takesAntihypertensiveMedication: false,
      backupFrequency: 'disabled',
      backupFolder: 'Descargas/Copias_Tension_Arterial',
    };
  }
}

export async function saveSettingsAPI(settings: AppSettings): Promise<AppSettings> {
  try {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('Error al guardar ajustes en el servidor');
    const saved = await res.json();
    localStorage.setItem('server_bp_settings_cache', JSON.stringify(saved));
    return saved;
  } catch {
    localStorage.setItem('server_bp_settings_cache', JSON.stringify(settings));
    return settings;
  }
}

export async function generateServerBackupAPI(csvContent: string, filenamePrefix: string): Promise<{ success: boolean; filename: string; timestamp: string }> {
  try {
    const res = await fetch(`${API_BASE}/backups/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvContent, filenamePrefix }),
    });
    if (!res.ok) throw new Error('Error al enviar copia de seguridad al servidor');
    return await res.json();
  } catch (error) {
    console.warn('No se pudo guardar la copia física en el servidor:', error);
    return { success: false, filename: '', timestamp: new Date().toISOString() };
  }
}
