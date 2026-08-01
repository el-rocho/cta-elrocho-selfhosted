import type { AppSettings, BloodPressureReading } from '../types/bloodPressure';

/**
 * Indica si corresponde recordar al usuario que cree una copia completa.
 * La descarga requiere una accion del usuario para funcionar de forma fiable
 * en navegadores, PWA y WebView.
 */
export function isBackupDue(
  readings: BloodPressureReading[],
  settings: AppSettings,
  now = new Date()
): boolean {
  if (settings.backupFrequency === 'disabled' || readings.length === 0) return false;

  const lastBackup = settings.lastFullBackupTimestamp ? new Date(settings.lastFullBackupTimestamp) : null;
  if (!lastBackup || !Number.isFinite(lastBackup.getTime())) return true;

  const diffMs = now.getTime() - lastBackup.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffHours / 24;

  if (settings.backupFrequency === 'daily') {
    return now.toDateString() !== lastBackup.toDateString() && diffHours >= 12;
  }
  if (settings.backupFrequency === 'weekly') return diffDays >= 7;
  if (settings.backupFrequency === 'monthly') return diffDays >= 30;
  return false;
}
