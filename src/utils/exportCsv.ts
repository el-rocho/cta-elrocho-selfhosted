import type { BloodPressureSession, DateRange, ExportReportOptions, LanguageOption } from '../types/bloodPressure';
import { getConfirmedPulsePressureAlerts, getCulpritLabel, getGuidelineName, getHealthAssessment, getHealthDisclaimer, getSessionMedicationContext } from './healthClassification';
import { getEffectiveSessionReadings } from './whiteCoatAlgorithm';

function subtractCalendarMonthsClamped(date: Date, months: number): Date {
  const result = new Date(date);
  const originalDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() - months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, lastDay));
  return result;
}

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

    if (dateRange.preset === '1month') {
      return sDate >= subtractCalendarMonthsClamped(now, 1) && sDate <= now;
    }

    if (dateRange.preset === '3months') {
      return sDate >= subtractCalendarMonthsClamped(now, 3) && sDate <= now;
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

export function buildCSVContent(
  sessions: BloodPressureSession[],
  dateRange: DateRange,
  options: ExportReportOptions = {},
  lang: LanguageOption = 'es'
): string {
  const filtered = filterSessionsByDateRange(sessions, dateRange);

  const isEn = lang === 'en';
  const guidelineProfile = options.guidelineProfile ?? 'esc-2024';

  const headers = isEn
    ? [
        'Date',
        'Time',
        'Systolic_mmHg',
        'Diastolic_mmHg',
        'Pulse_BPM',
        'Arm',
        'Medication_Context',
        'BP_Classification',
        'Readings_In_Session',
        'Discarded_Readings',
        'Notes',
        'Pulse_Pressure_mmHg',
        'Alert_Culprit',
        'Pulse_Pressure_Confirmed',
        'Informational_Alerts',
      ]
    : [
        'Fecha',
        'Hora',
        'Sistolica_mmHg',
        'Diastolica_mmHg',
        'Pulsaciones_ppm',
        'Brazo',
        'Contexto_Medicacion',
        'Clasificacion_PA',
        'Tomas_En_Sesion',
        'Tomas_Descartadas',
        'Notas',
        'Presion_Pulso_mmHg',
        'Valor_Causante',
        'Presion_Pulso_Confirmada',
        'Avisos_Informativos',
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
  metadataHeader += `# ${isEn ? 'Antihypertensive medication' : 'Medicación antihipertensiva'}: ${options.takesAntihypertensiveMedication ? (isEn ? 'Yes' : 'Sí') : 'No'}\n`;
  metadataHeader += `# ${isEn ? 'Classification reference' : 'Referencia de clasificación'}: ${getGuidelineName(guidelineProfile, lang)}\n`;
  metadataHeader += `# ${isEn ? 'Notice' : 'Aviso'}: ${getHealthDisclaimer(lang, guidelineProfile)}\n`;

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

    const pulsePressureConfirmed = s.readings.some((reading) => reading.pulsePressureWarningConfirmed === true);
    const sessionTakesMedication = getSessionMedicationContext(
      s.readings,
      options.takesAntihypertensiveMedication === true
    );
    const assessment = getHealthAssessment(
      s.averageSystolic,
      s.averageDiastolic,
      s.averageHeartRate,
      lang,
      guidelineProfile
    );
    const sessionAlerts = [
      ...assessment.safetyAlerts,
      ...assessment.alerts,
      ...getConfirmedPulsePressureAlerts(getEffectiveSessionReadings(s), lang),
    ];
    const armStr = s.arm === 'left' ? (isEn ? 'Left' : 'Izquierdo') : (isEn ? 'Right' : 'Derecho');
    const notesClean = s.notes ? `"${s.notes.replace(/"/g, '""')}"` : '';
    const alertsClean = sessionAlerts.length > 0
      ? `"${sessionAlerts.map((alert) => alert.name).join(' | ').replace(/"/g, '""')}"`
      : '';

    return [
      dateStr,
      timeStr,
      s.averageSystolic,
      s.averageDiastolic,
      s.averageHeartRate,
      armStr,
      sessionTakesMedication ? 'true' : 'false',
      `"${assessment.category.name}"`,
      s.readings.length,
      s.discardedCount,
      notesClean,
      assessment.pulsePressure,
      assessment.culprit === 'none' ? '' : `"${getCulpritLabel(assessment.culprit, assessment.category.direction, lang)}"`,
      pulsePressureConfirmed ? 'true' : 'false',
      alertsClean,
    ].join(';');
  });

  const csvContent = '\uFEFFsep=;\n' + metadataHeader + headers.join(';') + '\n' + rows.join('\n');

  return csvContent;
}

export function exportToCSV(
  sessions: BloodPressureSession[],
  dateRange: DateRange,
  filenamePrefix = 'tension_arterial',
  options: ExportReportOptions = {},
  lang: LanguageOption = 'es'
): void {
  const csvContent = buildCSVContent(sessions, dateRange, options, lang);

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
