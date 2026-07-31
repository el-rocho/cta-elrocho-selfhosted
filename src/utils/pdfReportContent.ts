import type {
  BloodPressureSession,
  GuidelineProfile,
  HealthAlertInfo,
  LanguageOption,
} from '../types/bloodPressure';
import {
  getConfirmedPulsePressureAlerts,
  getCulpritLabel,
  getHealthAssessment,
} from './healthClassification';
import { getEffectiveSessionReadings } from './whiteCoatAlgorithm';

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
  const effectiveCount = Math.max(0, session.readings.length - session.discardedCount);

  if (session.discardedCount > 0) {
    if (isEn) {
      const effective = `${effectiveCount} effective reading${effectiveCount === 1 ? '' : 's'}`;
      const discarded = `${session.discardedCount} discarded`;
      return ` (Result from ${effective}; ${discarded})`;
    }
    const effective = `${effectiveCount} ${effectiveCount === 1 ? 'toma efectiva' : 'tomas efectivas'}`;
    const discarded = `${session.discardedCount} ${session.discardedCount === 1 ? 'descartada' : 'descartadas'}`;
    return ` (Resultado de ${effective}; ${discarded})`;
  }

  return isEn
    ? ` (Average of ${session.readings.length} readings)`
    : ` (Media de ${session.readings.length} tomas)`;
}

export function buildPDFMeasurementRowsHTML(
  sessions: BloodPressureSession[],
  lang: LanguageOption = 'es',
  guidelineProfile: GuidelineProfile = 'esc-2024'
): string {
  const isEn = lang === 'en';
  const locale = isEn ? 'en-US' : 'es-ES';

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
      const sessionAlerts = [
        ...assessment.safetyAlerts,
        ...assessment.alerts,
        ...getConfirmedPulsePressureAlerts(getEffectiveSessionReadings(session), lang),
      ];
      const category = assessment.category;
      const armLabel = session.arm === 'left' ? (isEn ? 'Left' : 'Izq') : (isEn ? 'Right' : 'Der');
      const sessionTag = getSessionTag(session, isEn);
      const background = index % 2 === 0 ? '#ffffff' : '#f8fafc';

      return `
        <tr style="background-color: ${background};">
          <td style="padding: 7px 10px; border-bottom: 1px solid #e2e8f0;"><strong>${dateStr}</strong> ${timeStr}</td>
          <td style="padding: 7px 10px; border-bottom: 1px solid #e2e8f0;"><strong style="font-size:12px; color:#ef4444;">${session.averageSystolic}</strong> mmHg</td>
          <td style="padding: 7px 10px; border-bottom: 1px solid #e2e8f0;"><strong style="font-size:12px; color:#3b82f6;">${session.averageDiastolic}</strong> mmHg</td>
          <td style="padding: 7px 10px; border-bottom: 1px solid #e2e8f0;"><strong style="font-size:12px; color:#64748b;">${session.averageHeartRate}</strong> ${isEn ? 'BPM' : 'ppm'}</td>
          <td style="padding: 7px 10px; border-bottom: 1px solid #e2e8f0;">${armLabel}</td>
          <td style="padding: 7px 10px; border-bottom: 1px solid #e2e8f0;">
            <span style="display:inline-block; padding:2px 8px; border-radius:9999px; font-size:10px; font-weight:600; background:${category.badgeBg}; color:${category.badgeText};">
              ${category.name}
            </span>
            ${assessment.culprit !== 'none'
              ? `<div style="font-size:8.5px; color:#475569; margin-top:3px;">${getCulpritLabel(assessment.culprit, assessment.category.direction, lang)}</div>`
              : ''}
            ${sessionAlerts.length > 0
              ? `<div style="display:flex; flex-wrap:wrap; gap:3px; margin-top:4px;">${renderAlertBadges(sessionAlerts)}</div>`
              : ''}
          </td>
          <td style="padding: 7px 10px; border-bottom: 1px solid #e2e8f0;">${(session.notes || '') + sessionTag}</td>
        </tr>
      `;
    })
    .join('');
}
