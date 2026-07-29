import type {
  HealthAlertInfo,
  HealthAlertKey,
  HealthAlertLevel,
  HealthAssessment,
  HealthCategoryInfo,
  HealthCulprit,
  HealthSeverity,
  LanguageOption,
  BloodPressureReading,
} from '../types/bloodPressure';
import { getTranslation } from '../i18n/translations';

const BASE_CATEGORIES_STYLE: Record<HealthSeverity, { colorHex: string; badgeBg: string; badgeText: string }> = {
  hypotension: { colorHex: '#2563eb', badgeBg: 'rgba(37, 99, 235, 0.14)', badgeText: '#1d4ed8' },
  overtreatment: { colorHex: '#0891b2', badgeBg: 'rgba(8, 145, 178, 0.14)', badgeText: '#0e7490' },
  optimal: { colorHex: '#10b981', badgeBg: 'rgba(16, 185, 129, 0.15)', badgeText: '#059669' },
  elevated: { colorHex: '#f97316', badgeBg: 'rgba(249, 115, 22, 0.15)', badgeText: '#c2410c' },
  hypertension: { colorHex: '#dc2626', badgeBg: 'rgba(220, 38, 38, 0.15)', badgeText: '#b91c1c' },
};

const BASE_ALERTS_STYLE: Record<HealthAlertKey, { level: HealthAlertLevel; colorHex: string; badgeBg: string; badgeText: string }> = {
  lowDiastolic: { level: 'caution', colorHex: '#2563eb', badgeBg: 'rgba(37, 99, 235, 0.14)', badgeText: '#1d4ed8' },
  narrowPulsePressure: { level: 'warning', colorHex: '#f59e0b', badgeBg: 'rgba(245, 158, 11, 0.16)', badgeText: '#b45309' },
  widePulsePressure: { level: 'warning', colorHex: '#f59e0b', badgeBg: 'rgba(245, 158, 11, 0.16)', badgeText: '#b45309' },
  bradycardia: { level: 'info', colorHex: '#0ea5e9', badgeBg: 'rgba(14, 165, 233, 0.14)', badgeText: '#0369a1' },
  tachycardia: { level: 'caution', colorHex: '#f97316', badgeBg: 'rgba(249, 115, 22, 0.15)', badgeText: '#c2410c' },
  hypotensionTachycardia: { level: 'warning', colorHex: '#e11d48', badgeBg: 'rgba(225, 29, 72, 0.14)', badgeText: '#be123c' },
  hypertensionTachycardia: { level: 'warning', colorHex: '#dc2626', badgeBg: 'rgba(220, 38, 38, 0.14)', badgeText: '#b91c1c' },
};

const CATEGORY_RANK: Record<HealthSeverity, number> = {
  optimal: 0,
  overtreatment: 1,
  elevated: 2,
  hypotension: 3,
  hypertension: 4,
};

export function getHealthCategoriesMap(lang: LanguageOption = 'es', takesMedication = false): Record<HealthSeverity, HealthCategoryInfo> {
  const keys: HealthSeverity[] = ['hypotension', 'overtreatment', 'optimal', 'elevated', 'hypertension'];
  const profileKey = takesMedication ? 'medicated' : 'unmedicated';
  const map = {} as Record<HealthSeverity, HealthCategoryInfo>;
  keys.forEach((key) => {
    map[key] = {
      key,
      name: getTranslation(lang, `trend.categories.${key}.${profileKey}Name`),
      description: getTranslation(lang, `trend.categories.${key}.${profileKey}Desc`),
      ...BASE_CATEGORIES_STYLE[key],
    };
  });
  return map;
}

export const HEALTH_CATEGORIES = getHealthCategoriesMap('es');

export function calculatePulsePressure(systolic: number, diastolic: number): number {
  return systolic - diastolic;
}

export function getReadingMedicationContext(
  reading: Pick<BloodPressureReading, 'takesAntihypertensiveMedication'>,
  fallback = false
): boolean {
  return typeof reading.takesAntihypertensiveMedication === 'boolean'
    ? reading.takesAntihypertensiveMedication
    : fallback;
}

export function getSessionMedicationContext(
  readings: Pick<BloodPressureReading, 'takesAntihypertensiveMedication'>[],
  fallback = false
): boolean {
  return readings.length > 0 ? getReadingMedicationContext(readings[0], fallback) : fallback;
}

export function requiresPulsePressureConfirmation(systolic: number, diastolic: number): boolean {
  const pulsePressure = calculatePulsePressure(systolic, diastolic);
  return pulsePressure < 25 || pulsePressure > 60;
}

function getSystolicCategory(systolic: number, takesMedication: boolean): HealthSeverity {
  if (systolic < 90) return 'hypotension';
  if (!takesMedication) {
    if (systolic < 120) return 'optimal';
    if (systolic < 135) return 'elevated';
    return 'hypertension';
  }
  if (systolic < 115) return 'overtreatment';
  if (systolic < 125) return 'optimal';
  if (systolic < 135) return 'elevated';
  return 'hypertension';
}

function getDiastolicCategory(diastolic: number, takesMedication: boolean): HealthSeverity {
  if (diastolic < 60) return 'hypotension';
  if (!takesMedication) {
    if (diastolic < 80) return 'optimal';
    if (diastolic < 85) return 'elevated';
    return 'hypertension';
  }
  if (diastolic < 65) return 'overtreatment';
  if (diastolic < 75) return 'optimal';
  if (diastolic < 85) return 'elevated';
  return 'hypertension';
}

function resolveCategoryAndCulprit(systolic: number, diastolic: number, takesMedication: boolean): { key: HealthSeverity; culprit: HealthCulprit } {
  const systolicKey = getSystolicCategory(systolic, takesMedication);
  const diastolicKey = getDiastolicCategory(diastolic, takesMedication);
  const systolicRank = CATEGORY_RANK[systolicKey];
  const diastolicRank = CATEGORY_RANK[diastolicKey];
  if (systolicRank === 0 && diastolicRank === 0) return { key: 'optimal', culprit: 'none' };
  if (systolicRank > diastolicRank) return { key: systolicKey, culprit: 'systolic' };
  if (diastolicRank > systolicRank) return { key: diastolicKey, culprit: 'diastolic' };
  return { key: systolicKey, culprit: 'both' };
}

export function getHealthCategory(systolic: number, diastolic: number, lang: LanguageOption = 'es', takesMedication = false): HealthCategoryInfo {
  const { key } = resolveCategoryAndCulprit(systolic, diastolic, takesMedication);
  return getHealthCategoriesMap(lang, takesMedication)[key];
}

function createAlert(key: HealthAlertKey, lang: LanguageOption, params?: Record<string, string | number>): HealthAlertInfo {
  return {
    key,
    name: getTranslation(lang, `healthAlerts.${key}.name`, params),
    description: getTranslation(lang, `healthAlerts.${key}.desc`, params),
    ...BASE_ALERTS_STYLE[key],
  };
}

export function getConfirmedPulsePressureAlerts(
  readings: Pick<BloodPressureReading, 'systolic' | 'diastolic' | 'pulsePressureWarningConfirmed'>[],
  lang: LanguageOption = 'es'
): HealthAlertInfo[] {
  const alerts = new Map<HealthAlertKey, HealthAlertInfo>();
  readings.forEach((reading) => {
    if (reading.pulsePressureWarningConfirmed !== true) return;
    const pulsePressure = calculatePulsePressure(reading.systolic, reading.diastolic);
    if (pulsePressure < 25 && !alerts.has('narrowPulsePressure')) alerts.set('narrowPulsePressure', createAlert('narrowPulsePressure', lang, { value: pulsePressure }));
    else if (pulsePressure > 60 && !alerts.has('widePulsePressure')) alerts.set('widePulsePressure', createAlert('widePulsePressure', lang, { value: pulsePressure }));
  });
  return [...alerts.values()];
}

export function getHealthAlerts(
  systolic: number,
  diastolic: number,
  heartRate: number,
  lang: LanguageOption = 'es',
  takesMedication = false,
  pulsePressureWarningConfirmed = false
): HealthAlertInfo[] {
  const alerts: HealthAlertInfo[] = [];
  const pulsePressure = calculatePulsePressure(systolic, diastolic);
  const category = getHealthCategory(systolic, diastolic, lang, takesMedication);
  const hasValidHeartRate = Number.isFinite(heartRate) && heartRate > 0;
  const hasTachycardia = hasValidHeartRate && heartRate > 100;
  if (diastolic < 60) alerts.push(createAlert('lowDiastolic', lang, { value: diastolic }));
  if (category.key === 'hypotension' && hasTachycardia) alerts.push(createAlert('hypotensionTachycardia', lang));
  if (category.key === 'hypertension' && hasTachycardia) alerts.push(createAlert('hypertensionTachycardia', lang));
  if (pulsePressureWarningConfirmed && pulsePressure < 25) {
    alerts.push(createAlert('narrowPulsePressure', lang, { value: pulsePressure }));
  } else if (pulsePressureWarningConfirmed && pulsePressure > 60) {
    alerts.push(createAlert('widePulsePressure', lang, { value: pulsePressure }));
  }
  if (hasValidHeartRate && heartRate < 50) alerts.push(createAlert('bradycardia', lang, { value: heartRate }));
  else if (hasTachycardia) alerts.push(createAlert('tachycardia', lang, { value: heartRate }));
  return alerts;
}

export function getHealthAssessment(
  systolic: number,
  diastolic: number,
  heartRate: number,
  lang: LanguageOption = 'es',
  takesMedication = false,
  pulsePressureWarningConfirmed = false
): HealthAssessment {
  const { key, culprit } = resolveCategoryAndCulprit(systolic, diastolic, takesMedication);
  return {
    category: getHealthCategoriesMap(lang, takesMedication)[key],
    alerts: getHealthAlerts(systolic, diastolic, heartRate, lang, takesMedication, pulsePressureWarningConfirmed),
    pulsePressure: calculatePulsePressure(systolic, diastolic),
    culprit,
  };
}

export function getCulpritLabel(
  culprit: HealthCulprit,
  category: HealthSeverity,
  lang: LanguageOption = 'es'
): string {
  if (culprit === 'none') return '';
  const direction = category === 'hypotension' || category === 'overtreatment' ? 'low' : 'high';
  return getTranslation(lang, `healthAssessment.culprit.${direction}.${culprit}`);
}

export function getHealthDisclaimer(lang: LanguageOption = 'es'): string {
  return getTranslation(lang, 'healthAlerts.disclaimer');
}
