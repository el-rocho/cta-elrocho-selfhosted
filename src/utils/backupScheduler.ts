import type { BloodPressureSession, AppSettings } from '../types/bloodPressure';
import { exportToCSV } from './exportCsv';

/**
 * Comprueba si corresponde realizar una copia de seguridad automática en CSV
 * y la ejecuta si ha vencido el plazo configurado (diaria a las 00:00, semanal o mensual).
 */
export function checkAndExecuteAutoBackup(
  sessions: BloodPressureSession[],
  settings: AppSettings,
  onUpdateSettings: (newSettings: AppSettings) => void
): { backupExecuted: boolean; dateStr?: string } {
  if (settings.backupFrequency === 'disabled' || sessions.length === 0) {
    return { backupExecuted: false };
  }

  const now = new Date();
  const lastBackup = settings.lastBackupTimestamp ? new Date(settings.lastBackupTimestamp) : null;

  // Si es el primer inicio y NUNCA se ha registrado una fecha de copia, fijamos el reloj desde hoy SIN disparar la descarga
  if (!lastBackup) {
    onUpdateSettings({
      ...settings,
      lastBackupTimestamp: now.toISOString(),
    });
    return { backupExecuted: false };
  }

  let isDue = false;
  const diffMs = now.getTime() - lastBackup.getTime();
  const diffHours = diffMs / (1000 * 3600);
  const diffDays = diffMs / (1000 * 3600 * 24);

  if (settings.backupFrequency === 'daily') {
    const isDifferentDay = now.getDate() !== lastBackup.getDate() || now.getMonth() !== lastBackup.getMonth();
    if (isDifferentDay && diffHours >= 12) {
      isDue = true;
    }
  } else if (settings.backupFrequency === 'weekly') {
    if (diffDays >= 7) {
      isDue = true;
    }
  } else if (settings.backupFrequency === 'monthly') {
    if (diffDays >= 30) {
      isDue = true;
    }
  }

  if (isDue) {
    // Unificar formato de nombre: tension_arterial_daily_AAAA-MM-DD_HH-MM-SS.csv
    const prefix = `tension_arterial_${settings.backupFrequency}`;
    exportToCSV(sessions, { preset: 'all' }, prefix, {
      patientName: settings.patientName,
      patientSex: settings.patientSex,
      patientAge: settings.patientAge,
      patientBirthDate: settings.patientBirthDate,
      takesAntihypertensiveMedication: settings.takesAntihypertensiveMedication,
    }, settings.language);

    onUpdateSettings({
      ...settings,
      lastBackupTimestamp: now.toISOString(),
    });

    return {
      backupExecuted: true,
      dateStr: now.toLocaleDateString('es-ES') + ' ' + now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
    };
  }

  return { backupExecuted: false };
}
