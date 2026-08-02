import type { BloodPressureReading, AppSettings } from '../types/bloodPressure';

const API_BASE = '/api';

const DAY_MS = 1000 * 60 * 60 * 24;

// Mismos diez ejemplos utilizados por las versiones individual, cliente y autoalojada.
function createDemoReadings(referenceMs = Date.now()): BloodPressureReading[] {
  const demoTimestamp = (daysAgo: number) => new Date(referenceMs - DAY_MS * daysAgo).toISOString();
  return [
  {
    id: 'demo-optimal-unmedicated',
    timestamp: demoTimestamp(0),
    systolic: 115,
    diastolic: 75,
    heartRate: 72,
    arm: 'left',
    notes: 'Ejemplo verde: óptima sin medicación',
    pulsePressureWarningConfirmed: false,
    takesAntihypertensiveMedication: false,
  },
  {
    id: 'demo-optimal-medicated',
    timestamp: demoTimestamp(2),
    systolic: 120,
    diastolic: 70,
    heartRate: 68,
    arm: 'right',
    notes: 'Ejemplo verde: óptima con medicación',
    pulsePressureWarningConfirmed: false,
    takesAntihypertensiveMedication: true,
  },
  {
    id: 'demo-hypotension',
    timestamp: demoTimestamp(6),
    systolic: 88,
    diastolic: 58,
    heartRate: 105,
    arm: 'left',
    notes: 'Ejemplo azul: hipotensión con taquicardia',
    pulsePressureWarningConfirmed: false,
    takesAntihypertensiveMedication: false,
  },
  {
    id: 'demo-suboptimal-medicated',
    timestamp: demoTimestamp(10),
    systolic: 110,
    diastolic: 62,
    heartRate: 66,
    arm: 'right',
    notes: 'Ejemplo turquesa: subóptima con medicación',
    pulsePressureWarningConfirmed: false,
    takesAntihypertensiveMedication: true,
  },
  {
    id: 'demo-elevated-unmedicated',
    timestamp: demoTimestamp(20),
    systolic: 130,
    diastolic: 82,
    heartRate: 74,
    arm: 'left',
    notes: 'Ejemplo naranja: presión elevada sin medicación',
    pulsePressureWarningConfirmed: false,
    takesAntihypertensiveMedication: false,
  },
  {
    id: 'demo-elevated-medicated',
    timestamp: demoTimestamp(45),
    systolic: 128,
    diastolic: 78,
    heartRate: 76,
    arm: 'right',
    notes: 'Ejemplo naranja: franja elevada con medicación',
    pulsePressureWarningConfirmed: false,
    takesAntihypertensiveMedication: true,
  },
  {
    id: 'demo-hypertension-systolic',
    timestamp: demoTimestamp(75),
    systolic: 138,
    diastolic: 82,
    heartRate: 72,
    arm: 'left',
    notes: 'Ejemplo rojo: sistólica elevada',
    pulsePressureWarningConfirmed: false,
    takesAntihypertensiveMedication: false,
  },
  {
    id: 'demo-hypertension-diastolic',
    timestamp: demoTimestamp(100),
    systolic: 125,
    diastolic: 88,
    heartRate: 106,
    arm: 'right',
    notes: 'Ejemplo rojo: diastólica elevada con taquicardia',
    pulsePressureWarningConfirmed: false,
    takesAntihypertensiveMedication: true,
  },
  {
    id: 'demo-narrow-pulse-pressure',
    timestamp: demoTimestamp(180),
    systolic: 100,
    diastolic: 78,
    heartRate: 48,
    arm: 'left',
    notes: 'Ejemplo: presión de pulso estrecha y bradicardia',
    pulsePressureWarningConfirmed: true,
    takesAntihypertensiveMedication: false,
  },
  {
    id: 'demo-wide-pulse-pressure',
    timestamp: demoTimestamp(365),
    systolic: 150,
    diastolic: 85,
    heartRate: 70,
    arm: 'right',
    notes: 'Ejemplo rojo: ambos valores elevados y presión de pulso amplia',
    pulsePressureWarningConfirmed: true,
    takesAntihypertensiveMedication: false,
  },
  ];
}

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
    return cached ? JSON.parse(cached) : createDemoReadings();
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
    const current = cached ? JSON.parse(cached) : createDemoReadings();
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
    const demoReadings = createDemoReadings();
    localStorage.setItem('server_bp_readings_cache', JSON.stringify(demoReadings));
    return demoReadings;
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
    const current: BloodPressureReading[] = cached ? JSON.parse(cached) : createDemoReadings();
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
    const data = await res.json();
    return { guidelineProfile: 'esc-2024', ...data, whiteCoatIntervalMinutes: 5 };
  } catch {
    const cached = localStorage.getItem('server_bp_settings_cache');
    return cached ? { guidelineProfile: 'esc-2024', ...JSON.parse(cached), whiteCoatIntervalMinutes: 5 } : {
      language: 'es',
      enableWhiteCoatFilter: false,
      whiteCoatIntervalMinutes: 5,
      defaultArm: 'left',
      preferredInputMode: 'keyboard',
      guidelineProfile: 'esc-2024',
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
  const fixedSettings: AppSettings = { ...settings, whiteCoatIntervalMinutes: 5 };
  try {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fixedSettings),
    });
    if (!res.ok) throw new Error('Error al guardar ajustes en el servidor');
    const saved = { ...await res.json(), whiteCoatIntervalMinutes: 5 };
    localStorage.setItem('server_bp_settings_cache', JSON.stringify(saved));
    return saved;
  } catch {
    localStorage.setItem('server_bp_settings_cache', JSON.stringify(fixedSettings));
    return fixedSettings;
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
