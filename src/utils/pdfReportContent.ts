import type {
  AppSettings,
  BloodPressureSession,
  GuidelineProfile,
  HealthAlertInfo,
  LanguageOption,
} from '../types/bloodPressure';
import {
  getConfirmedPulsePressureAlerts,
  getCulpritLabel,
  getHealthAssessment,
  getSessionMedicationContext,
} from './healthClassification';
import { getEffectiveSessionReadings } from './whiteCoatAlgorithm';
import { assessTreatmentTarget, getTreatmentTargetStatusLabel, type TreatmentTargetAssessment } from './treatmentTarget';
import { getSessionResultType, getSessionResultTypeInfo } from './sessionResultType';

function renderAlertBadges(alerts: HealthAlertInfo[]): string {
  return alerts
    .map(
      (alert) => `
        <span title="${alert.description}" style="display:inline-block; padding:2px 6px; border-radius:9999px; font-size:8.5px; line-height:1.2; font-weight:600; background:${alert.badgeBg}; color:${alert.badgeText};">
          ${alert.name}
        </span>
      `
    )
    .join('');
}

function getSessionTag(session: BloodPressureSession, isEn: boolean): string {
  if (session.readings.length <= 1) return '';
  const averageCount = session.discardedCount > 0
    ? Math.max(1, session.readings.length - session.discardedCount)
    : session.readings.length;

  if (isEn) {
    return ` (Average of ${averageCount} ${averageCount === 1 ? 'reading' : 'readings'})`;
  }
  return ` (Media de ${averageCount} ${averageCount === 1 ? 'medición' : 'mediciones'})`;
}

function renderTreatmentTargetBadge(assessment: TreatmentTargetAssessment, lang: LanguageOption): string {
  const presentations = {
    within: { background: 'rgba(16,185,129,0.14)', color: '#047857', dot: '#10b981' },
    below: { background: 'rgba(251,146,60,0.15)', color: '#ea580c', dot: '#fb923c' },
    above: { background: 'rgba(194,65,12,0.16)', color: '#9a3412', dot: '#c2410c' },
    mixed: { background: 'rgba(194,65,12,0.16)', color: '#9a3412', dot: '#c2410c' },
  } as const;
  const presentation = presentations[assessment.status];
  const label = getTreatmentTargetStatusLabel(assessment.status, lang);
  const source = assessment.target.source === 'custom'
    ? (lang === 'en' ? 'Custom target' : 'Objetivo personalizado')
    : (lang === 'en' ? 'Guideline target' : 'Objetivo recomendado por la guía');
  return `<span data-treatment-target-status="${assessment.status}" title="${source}" style="display:inline-flex; align-items:center; gap:4px; padding:2px 7px; border-radius:9999px; font-size:9.5px; line-height:1.2; font-weight:600; background:${presentation.background}; color:${presentation.color}; white-space:nowrap;"><span style="width:5px; height:5px; border-radius:50%; background:${presentation.dot};"></span>${label}</span>`;
}

export function buildPDFMeasurementRowsHTML(
  sessions: BloodPressureSession[],
  lang: LanguageOption = 'es',
  guidelineProfile: GuidelineProfile = 'esc-2024',
  settings?: AppSettings
): string {
  const isEn = lang === 'en';
  const locale = isEn ? 'en-US' : 'es-ES';
  const showInformationalLabels = settings?.showInformationalLabels ?? true;

  return sessions
    .map((session, index) => {
      const date = new Date(session.timestamp);
      const dateStr = date.toLocaleDateString(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      const timeStr = date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
      const assessment = getHealthAssessment(
        session.averageSystolic,
        session.averageDiastolic,
        session.averageHeartRate,
        lang,
        guidelineProfile
      );
      const sessionAlerts = showInformationalLabels
        ? [...assessment.safetyAlerts, ...assessment.alerts, ...getConfirmedPulsePressureAlerts(getEffectiveSessionReadings(session), lang)]
        : assessment.safetyAlerts;
      const category = assessment.category;
      const armLabel = session.arm === 'left' ? (isEn ? 'Left' : 'Izq') : (isEn ? 'Right' : 'Der');
      const sessionTag = getSessionTag(session, isEn);
      const background = index % 2 === 0 ? '#ffffff' : '#f8fafc';
      const resultType = getSessionResultTypeInfo(getSessionResultType(session), lang);
      const targetAssessment = settings && getSessionMedicationContext(
        session.readings,
        settings.takesAntihypertensiveMedication
      )
        ? assessTreatmentTarget(session.averageSystolic, session.averageDiastolic, settings)
        : undefined;

      return `
        <tr style="background-color: ${background};">
          <td style="padding: 7px 10px; border-bottom: 1px solid #e2e8f0;"><span data-result-type="${resultType.key}" title="${resultType.reportLabel}" style="display:inline-flex; align-items:center; justify-content:center; width:15px; height:15px; margin-right:6px; border-radius:4px; background:${resultType.color}; color:#111827; font-size:9px; line-height:1; font-weight:700; vertical-align:1px;">${resultType.reportCode}</span><strong>${dateStr}</strong> ${timeStr}</td>
          <td style="padding: 7px 10px; border-bottom: 1px solid #e2e8f0;"><strong style="font-size:12px; color:#ef4444;">${session.averageSystolic}</strong> mmHg</td>
          <td style="padding: 7px 10px; border-bottom: 1px solid #e2e8f0;"><strong style="font-size:12px; color:#3b82f6;">${session.averageDiastolic}</strong> mmHg</td>
          <td style="padding: 7px 10px; border-bottom: 1px solid #e2e8f0;"><strong style="font-size:12px; color:#64748b;">${session.averageHeartRate}</strong> ${isEn ? 'BPM' : 'ppm'}</td>
          <td style="padding: 7px 10px; border-bottom: 1px solid #e2e8f0;">${armLabel}</td>
          <td style="padding: 7px 10px; border-bottom: 1px solid #e2e8f0;">
            ${showInformationalLabels ? `<span style="display:inline-block; padding:2px 8px; border-radius:9999px; font-size:10px; font-weight:600; background:${category.badgeBg}; color:${category.badgeText};">
              ${category.name}
            </span>` : ''}
            ${showInformationalLabels && assessment.culprit !== 'none'
              ? `<div style="font-size:8.5px; color:#475569; margin-top:3px;">${getCulpritLabel(assessment.culprit, assessment.category.direction, lang)}</div>`
              : ''}
            ${sessionAlerts.length > 0
              ? `<div style="display:flex; flex-wrap:wrap; gap:3px; margin-top:4px;">${renderAlertBadges(sessionAlerts)}</div>`
              : ''}
          </td>
          ${showInformationalLabels ? `<td style="padding: 7px 8px; border-bottom: 1px solid #e2e8f0; text-align:center;">${targetAssessment ? renderTreatmentTargetBadge(targetAssessment, lang) : '—'}</td>` : ''}
          <td style="padding: 7px 10px; border-bottom: 1px solid #e2e8f0;">${(session.notes || '') + sessionTag}</td>
        </tr>
      `;
    })
    .join('');
}
