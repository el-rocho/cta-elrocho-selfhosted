import type {
  BloodPressureReading,
  GuidelineProfile,
  HealthAlertInfo,
  HealthAlertKey,
  HealthAlertLevel,
  HealthAlertScope,
  HealthAssessment,
  HealthCategoryInfo,
  HealthColorRole,
  HealthCulprit,
  HealthDirection,
  HealthSeverity,
  LanguageOption,
} from '../types/bloodPressure';
import { getTranslation } from '../i18n/translations';

export const GUIDELINE_PROFILES: GuidelineProfile[] = [
  'esc-2024',
  'aha-acc-2025',
  'ish-2020',
];

const PROFILE_TRANSLATION_KEYS: Record<GuidelineProfile, string> = {
  'esc-2024': 'esc2024',
  'aha-acc-2025': 'ahaAcc2025',
  'ish-2020': 'ish2020',
};

const PROFILE_CATEGORY_KEYS: Record<GuidelineProfile, HealthSeverity[]> = {
  'esc-2024': ['low', 'normal', 'elevated', 'hypertension', 'extreme'],
  'aha-acc-2025': ['low', 'normal', 'elevated', 'stage1', 'stage2', 'extreme'],
  'ish-2020': ['low', 'belowThreshold', 'aboveThreshold', 'extreme'],
};

const CATEGORY_PRESENTATION: Record<
  HealthSeverity,
  {
    direction: HealthDirection;
    colorRole: HealthColorRole;
    rank: number;
    colorHex: string;
    badgeBg: string;
    badgeText: string;
  }
> = {
  low: {
    direction: 'low',
    colorRole: 'blue',
    rank: 1,
    colorHex: '#2563eb',
    badgeBg: 'rgba(37, 99, 235, 0.14)',
    badgeText: '#1d4ed8',
  },
  normal: {
    direction: 'neutral',
    colorRole: 'green',
    rank: 0,
    colorHex: '#10b981',
    badgeBg: 'rgba(16, 185, 129, 0.15)',
    badgeText: '#047857',
  },
  belowThreshold: {
    direction: 'neutral',
    colorRole: 'green',
    rank: 0,
    colorHex: '#10b981',
    badgeBg: 'rgba(16, 185, 129, 0.15)',
    badgeText: '#047857',
  },
  elevated: {
    direction: 'high',
    colorRole: 'yellow',
    rank: 2,
    colorHex: '#d97706',
    badgeBg: 'rgba(217, 119, 6, 0.16)',
    badgeText: '#a16207',
  },
  hypertension: {
    direction: 'high',
    colorRole: 'orange',
    rank: 3,
    colorHex: '#f97316',
    badgeBg: 'rgba(249, 115, 22, 0.16)',
    badgeText: '#c2410c',
  },
  stage1: {
    direction: 'high',
    colorRole: 'orange',
    rank: 3,
    colorHex: '#f97316',
    badgeBg: 'rgba(249, 115, 22, 0.16)',
    badgeText: '#c2410c',
  },
  stage2: {
    direction: 'high',
    colorRole: 'orange',
    rank: 4,
    colorHex: '#ea580c',
    badgeBg: 'rgba(234, 88, 12, 0.17)',
    badgeText: '#9a3412',
  },
  aboveThreshold: {
    direction: 'high',
    colorRole: 'orange',
    rank: 3,
    colorHex: '#f97316',
    badgeBg: 'rgba(249, 115, 22, 0.16)',
    badgeText: '#c2410c',
  },
  extreme: {
    direction: 'extreme',
    colorRole: 'red',
    rank: 5,
    colorHex: '#dc2626',
    badgeBg: 'rgba(220, 38, 38, 0.16)',
    badgeText: '#b91c1c',
  },
};

const BASE_ALERTS_STYLE: Record<
  HealthAlertKey,
  {
    level: HealthAlertLevel;
    scope: HealthAlertScope;
    colorHex: string;
    badgeBg: string;
    badgeText: string;
  }
> = {
  extremeHighPressure: {
    level: 'urgent',
    scope: 'safety',
    colorHex: '#dc2626',
    badgeBg: 'rgba(220, 38, 38, 0.16)',
    badgeText: '#b91c1c',
  },
  lowBloodPressure: {
    level: 'caution',
    scope: 'measurement',
    colorHex: '#2563eb',
    badgeBg: 'rgba(37, 99, 235, 0.14)',
    badgeText: '#1d4ed8',
  },
  narrowPulsePressure: {
    level: 'warning',
    scope: 'measurement',
    colorHex: '#f59e0b',
    badgeBg: 'rgba(245, 158, 11, 0.16)',
    badgeText: '#b45309',
  },
  widePulsePressure: {
    level: 'warning',
    scope: 'measurement',
    colorHex: '#f59e0b',
    badgeBg: 'rgba(245, 158, 11, 0.16)',
    badgeText: '#b45309',
  },
  bradycardia: {
    level: 'info',
    scope: 'measurement',
    colorHex: '#0ea5e9',
    badgeBg: 'rgba(14, 165, 233, 0.14)',
    badgeText: '#0369a1',
  },
  tachycardia: {
    level: 'caution',
    scope: 'measurement',
    colorHex: '#f97316',
    badgeBg: 'rgba(249, 115, 22, 0.15)',
    badgeText: '#c2410c',
  },
  hypotensionTachycardia: {
    level: 'warning',
    scope: 'measurement',
    colorHex: '#e11d48',
    badgeBg: 'rgba(225, 29, 72, 0.14)',
    badgeText: '#be123c',
  },
  hypertensionTachycardia: {
    level: 'warning',
    scope: 'measurement',
    colorHex: '#dc2626',
    badgeBg: 'rgba(220, 38, 38, 0.14)',
    badgeText: '#b91c1c',
  },
};

interface DimensionClassification {
  key: HealthSeverity;
  rank: number;
}

interface ResolvedCategory {
  key: HealthSeverity;
  culprit: HealthCulprit;
}

export function getGuidelineName(
  profile: GuidelineProfile,
  lang: LanguageOption = 'es'
): string {
  return getTranslation(lang, `guidelines.${PROFILE_TRANSLATION_KEYS[profile]}.name`);
}

export function getGuidelineDescription(
  profile: GuidelineProfile,
  lang: LanguageOption = 'es'
): string {
  return getTranslation(lang, `guidelines.${PROFILE_TRANSLATION_KEYS[profile]}.description`);
}

export function getGuidelineSourceUrl(profile: GuidelineProfile): string {
  const urls: Record<GuidelineProfile, string> = {
    'esc-2024': 'https://academic.oup.com/eurheartj/article/45/38/3912/7741010',
    'aha-acc-2025': 'https://www.ahajournals.org/doi/10.1161/CIR.0000000000001356',
    'ish-2020': 'https://www.ahajournals.org/doi/10.1161/HYPERTENSIONAHA.120.15026',
  };
  return urls[profile];
}

function getCategoryTranslationPath(
  profile: GuidelineProfile,
  key: HealthSeverity,
  field: 'name' | 'desc'
): string {
  if (key === 'low' || key === 'extreme') {
    return `guidelines.common.${key}.${field}`;
  }
  return `guidelines.${PROFILE_TRANSLATION_KEYS[profile]}.categories.${key}.${field}`;
}

function createCategoryInfo(
  profile: GuidelineProfile,
  key: HealthSeverity,
  lang: LanguageOption
): HealthCategoryInfo {
  return {
    key,
    guidelineProfile: profile,
    name: getTranslation(lang, getCategoryTranslationPath(profile, key, 'name')),
    description: getTranslation(lang, getCategoryTranslationPath(profile, key, 'desc')),
    ...CATEGORY_PRESENTATION[key],
  };
}

export function getHealthCategories(
  profile: GuidelineProfile = 'esc-2024',
  lang: LanguageOption = 'es'
): HealthCategoryInfo[] {
  return PROFILE_CATEGORY_KEYS[profile].map((key) => createCategoryInfo(profile, key, lang));
}

export function getHealthCategoriesMap(
  lang: LanguageOption = 'es',
  profile: GuidelineProfile = 'esc-2024'
): Partial<Record<HealthSeverity, HealthCategoryInfo>> {
  return Object.fromEntries(
    getHealthCategories(profile, lang).map((category) => [category.key, category])
  );
}

export const HEALTH_CATEGORIES = getHealthCategoriesMap('es', 'esc-2024');

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

function classifyEscSystolic(value: number): DimensionClassification {
  if (value < 120) return { key: 'normal', rank: 0 };
  if (value < 135) return { key: 'elevated', rank: 2 };
  return { key: 'hypertension', rank: 3 };
}

function classifyEscDiastolic(value: number): DimensionClassification {
  if (value < 70) return { key: 'normal', rank: 0 };
  if (value < 85) return { key: 'elevated', rank: 2 };
  return { key: 'hypertension', rank: 3 };
}

function classifyAhaSystolic(value: number): DimensionClassification {
  if (value < 120) return { key: 'normal', rank: 0 };
  if (value < 130) return { key: 'elevated', rank: 1 };
  if (value < 140) return { key: 'stage1', rank: 2 };
  return { key: 'stage2', rank: 3 };
}

function classifyAhaDiastolic(value: number): DimensionClassification {
  if (value < 80) return { key: 'normal', rank: 0 };
  if (value < 90) return { key: 'stage1', rank: 2 };
  return { key: 'stage2', rank: 3 };
}

function classifyIshDimension(value: number, threshold: number): DimensionClassification {
  return value < threshold
    ? { key: 'belowThreshold', rank: 0 }
    : { key: 'aboveThreshold', rank: 1 };
}

function getDimensionClassifications(
  systolic: number,
  diastolic: number,
  profile: GuidelineProfile
): [DimensionClassification, DimensionClassification] {
  if (profile === 'aha-acc-2025') {
    return [classifyAhaSystolic(systolic), classifyAhaDiastolic(diastolic)];
  }
  if (profile === 'ish-2020') {
    return [classifyIshDimension(systolic, 135), classifyIshDimension(diastolic, 85)];
  }
  return [classifyEscSystolic(systolic), classifyEscDiastolic(diastolic)];
}

function resolveCategoryAndCulprit(
  systolic: number,
  diastolic: number,
  profile: GuidelineProfile
): ResolvedCategory {
  const extremeSys = systolic >= 180;
  const extremeDia = diastolic >= 120;
  if (extremeSys || extremeDia) {
    return {
      key: 'extreme',
      culprit: extremeSys && extremeDia ? 'both' : extremeSys ? 'systolic' : 'diastolic',
    };
  }

  const [systolicCategory, diastolicCategory] = getDimensionClassifications(
    systolic,
    diastolic,
    profile
  );
  const highestRank = Math.max(systolicCategory.rank, diastolicCategory.rank);

  if (highestRank === 0 && (systolic < 90 || diastolic < 60)) {
    const lowSys = systolic < 90;
    const lowDia = diastolic < 60;
    return {
      key: 'low',
      culprit: lowSys && lowDia ? 'both' : lowSys ? 'systolic' : 'diastolic',
    };
  }

  if (systolicCategory.rank > diastolicCategory.rank) {
    return { key: systolicCategory.key, culprit: 'systolic' };
  }
  if (diastolicCategory.rank > systolicCategory.rank) {
    return { key: diastolicCategory.key, culprit: 'diastolic' };
  }
  if (highestRank === 0) {
    return { key: systolicCategory.key, culprit: 'none' };
  }
  return { key: systolicCategory.key, culprit: 'both' };
}

export function getHealthCategory(
  systolic: number,
  diastolic: number,
  lang: LanguageOption = 'es',
  profile: GuidelineProfile = 'esc-2024'
): HealthCategoryInfo {
  const { key } = resolveCategoryAndCulprit(systolic, diastolic, profile);
  return createCategoryInfo(profile, key, lang);
}

function createAlert(
  key: HealthAlertKey,
  lang: LanguageOption,
  params?: Record<string, string | number>
): HealthAlertInfo {
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
    if (pulsePressure < 25 && !alerts.has('narrowPulsePressure')) {
      alerts.set('narrowPulsePressure', createAlert('narrowPulsePressure', lang, { value: pulsePressure }));
    } else if (pulsePressure > 60 && !alerts.has('widePulsePressure')) {
      alerts.set('widePulsePressure', createAlert('widePulsePressure', lang, { value: pulsePressure }));
    }
  });
  return [...alerts.values()];
}

export function getSafetyAlerts(
  systolic: number,
  diastolic: number,
  lang: LanguageOption = 'es'
): HealthAlertInfo[] {
  if (systolic >= 180 || diastolic >= 120) {
    return [
      createAlert('extremeHighPressure', lang, {
        systolic,
        diastolic,
      }),
    ];
  }
  return [];
}

export function getHealthAlerts(
  systolic: number,
  diastolic: number,
  heartRate: number,
  lang: LanguageOption = 'es',
  profile: GuidelineProfile = 'esc-2024',
  pulsePressureWarningConfirmed = false
): HealthAlertInfo[] {
  const alerts: HealthAlertInfo[] = [];
  const pulsePressure = calculatePulsePressure(systolic, diastolic);
  const category = getHealthCategory(systolic, diastolic, lang, profile);
  const hasValidHeartRate = Number.isFinite(heartRate) && heartRate > 0;
  const hasTachycardia = hasValidHeartRate && heartRate > 100;
  const hasLowValue = systolic < 90 || diastolic < 60;

  if (hasLowValue) {
    alerts.push(createAlert('lowBloodPressure', lang, { systolic, diastolic }));
  }
  if (category.key === 'low' && hasTachycardia) {
    alerts.push(createAlert('hypotensionTachycardia', lang));
  }
  if ((category.direction === 'high' || category.direction === 'extreme') && hasTachycardia) {
    alerts.push(createAlert('hypertensionTachycardia', lang));
  }
  if (pulsePressureWarningConfirmed && pulsePressure < 25) {
    alerts.push(createAlert('narrowPulsePressure', lang, { value: pulsePressure }));
  } else if (pulsePressureWarningConfirmed && pulsePressure > 60) {
    alerts.push(createAlert('widePulsePressure', lang, { value: pulsePressure }));
  }
  if (hasValidHeartRate && heartRate < 50) {
    alerts.push(createAlert('bradycardia', lang, { value: heartRate }));
  } else if (hasTachycardia) {
    alerts.push(createAlert('tachycardia', lang, { value: heartRate }));
  }

  return alerts;
}

export function getHealthAssessment(
  systolic: number,
  diastolic: number,
  heartRate: number,
  lang: LanguageOption = 'es',
  profile: GuidelineProfile = 'esc-2024',
  pulsePressureWarningConfirmed = false
): HealthAssessment {
  const { key, culprit } = resolveCategoryAndCulprit(systolic, diastolic, profile);
  return {
    category: createCategoryInfo(profile, key, lang),
    alerts: getHealthAlerts(
      systolic,
      diastolic,
      heartRate,
      lang,
      profile,
      pulsePressureWarningConfirmed
    ),
    safetyAlerts: getSafetyAlerts(systolic, diastolic, lang),
    pulsePressure: calculatePulsePressure(systolic, diastolic),
    culprit,
  };
}

export function getCulpritLabel(
  culprit: HealthCulprit,
  direction: HealthDirection,
  lang: LanguageOption = 'es'
): string {
  if (culprit === 'none') return '';
  const directionKey = direction === 'low' ? 'low' : 'high';
  return getTranslation(lang, `healthAssessment.culprit.${directionKey}.${culprit}`);
}

export function getHealthDisclaimer(
  lang: LanguageOption = 'es',
  profile: GuidelineProfile = 'esc-2024'
): string {
  return getTranslation(lang, 'healthAlerts.disclaimer', {
    guideline: getGuidelineName(profile, lang),
  });
}
