import type { BloodPressureSession, DateRange, ExportReportOptions, LanguageOption } from '../types/bloodPressure';
import { getHealthCategory } from './healthClassification';

export function filterSessionsByDateRange(
  sessions: BloodPressureSession[],
  dateRange: DateRange
): BloodPressureSession[] {
  if (dateRange.preset === 'all') return sessions;

  const now = new Date();

  return sessions.filter((s) => {
    const sDate = new Date(s.timestamp);

    if (dateRange.preset === '7days') {
      const diffMs = now.getTime() - sDate.getTime();
      return diffMs <= 7 * 24 * 60 * 60 * 1000;
    }

    if (dateRange.preset === '30days') {
      const diffMs = now.getTime() - sDate.getTime();
      return diffMs <= 30 * 24 * 60 * 60 * 1000;
    }

    if (dateRange.preset === '90days') {
      const diffMs = now.getTime() - sDate.getTime();
      return diffMs <= 90 * 24 * 60 * 60 * 1000;
    }

    if (dateRange.preset === 'custom') {
      if (dateRange.startDate && sDate < new Date(dateRange.startDate)) return false;
      if (dateRange.endDate) {
        const end = new Date(dateRange.endDate);
        end.setHours(23, 59, 59, 999);
        if (sDate > end) return false;
      }
      return true;
    }

    return true;
  });
}

export function exportToCSV(
  sessions: BloodPressureSession[],
  dateRange: DateRange,
  filenamePrefix = 'tension_arterial',
  options: ExportReportOptions = {},
  lang: LanguageOption = 'es'
): void {
  const filtered = filterSessionsByDateRange(sessions, dateRange);

  const isEn = lang === 'en';

  const headers = isEn
    ? [
        'Date',
        'Time',
        'Systolic_mmHg',
        'Diastolic_mmHg',
        'Pulse_BPM',
        'Arm',
        'WHO_Classification',
        'Readings_In_Session',
        'Discarded_Readings',
        'Notes',
      ]
    : [
        'Fecha',
        'Hora',
        'Sistolica_mmHg',
        'Diastolica_mmHg',
        'Pulsaciones_ppm',
        'Brazo',
        'Clasificacion_OMS',
        'Tomas_En_Sesion',
        'Tomas_Descartadas',
        'Notas',
      ];

  let metadataHeader = '';
  if (!options.hidePatientData) {
    if (options.patientName) metadataHeader += `# ${isEn ? 'Patient' : 'Paciente'}: ${options.patientName}\n`;
    if (options.patientSex) metadataHeader += `# ${isEn ? 'Sex' : 'Sexo'}: ${options.patientSex}\n`;
    if (options.patientAge) metadataHeader += `# ${isEn ? 'Age' : 'Edad'}: ${options.patientAge}\n`;
  }
  if (options.reportNotes) {
    metadataHeader += `# ${isEn ? 'Remarks' : 'Observaciones'}: ${options.reportNotes}\n`;
  }

  const locale = isEn ? 'en-US' : 'es-ES';

  const rows = filtered.map((s) => {
    const dateObj = new Date(s.timestamp);
    const dateStr = dateObj.toLocaleDateString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const timeStr = dateObj.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
    });

    const category = getHealthCategory(s.averageSystolic, s.averageDiastolic, lang);
    const armStr = s.arm === 'left' ? (isEn ? 'Left' : 'Izquierdo') : (isEn ? 'Right' : 'Derecho');
    const notesClean = s.notes ? `"${s.notes.replace(/"/g, '""')}"` : '';

    return [
      dateStr,
      timeStr,
      s.averageSystolic,
      s.averageDiastolic,
      s.averageHeartRate,
      armStr,
      `"${category.name}"`,
      s.readings.length,
      s.discardedCount,
      notesClean,
    ].join(';');
  });

  const csvContent = '\uFEFFsep=;\n' + metadataHeader + headers.join(';') + '\n' + rows.join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const dateTimeStr = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;

  link.setAttribute('href', url);
  link.setAttribute('download', `${filenamePrefix}_${dateTimeStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
