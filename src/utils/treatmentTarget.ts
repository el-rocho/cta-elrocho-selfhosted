import type { AppSettings, GuidelineProfile } from '../types/bloodPressure';

export type TreatmentTargetStatus = 'within' | 'below' | 'above' | 'mixed';
export interface TreatmentTargetDefinition { systolicMin?: number; systolicMax: number; diastolicMin?: number; diastolicMax: number; source: 'guideline' | 'custom'; profile: GuidelineProfile; }
export interface TreatmentTargetAssessment { status: TreatmentTargetStatus; target: TreatmentTargetDefinition; targetLabel: string; }

function getPatientAge(settings: AppSettings): number | null {
  if (typeof settings.patientAge === 'number' && Number.isFinite(settings.patientAge)) return settings.patientAge;
  if (!settings.patientBirthDate) return null;
  const birthDate = new Date(`${settings.patientBirthDate}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const beforeBirthday = today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : null;
}

export function getGuidelineTreatmentTarget(profile: GuidelineProfile, patientAge: number | null = null): TreatmentTargetDefinition {
  if (profile === 'aha-acc-2025') return { systolicMax: 129, diastolicMax: 79, source: 'guideline', profile };
  if (profile === 'ish-2020' && patientAge !== null && patientAge >= 65) return { systolicMin: 120, systolicMax: 139, diastolicMin: 70, diastolicMax: 89, source: 'guideline', profile };
  return { systolicMin: 120, systolicMax: 129, diastolicMin: 70, diastolicMax: 79, source: 'guideline', profile };
}

function hasValidCustomTarget(settings: AppSettings): boolean {
  return (settings.customTargetSystolicMin === 0 || settings.customTargetSystolicMin >= 70) && settings.customTargetSystolicMax <= 250 && (settings.customTargetDiastolicMin === 0 || settings.customTargetDiastolicMin >= 40) && settings.customTargetDiastolicMax <= 150 && (settings.customTargetSystolicMin === 0 || settings.customTargetSystolicMin <= settings.customTargetSystolicMax) && (settings.customTargetDiastolicMin === 0 || settings.customTargetDiastolicMin <= settings.customTargetDiastolicMax);
}

export function getTreatmentTarget(settings: AppSettings): TreatmentTargetDefinition {
  if (settings.treatmentTargetMode === 'custom' && hasValidCustomTarget(settings)) return { systolicMin: settings.customTargetSystolicMin || undefined, systolicMax: settings.customTargetSystolicMax, diastolicMin: settings.customTargetDiastolicMin || undefined, diastolicMax: settings.customTargetDiastolicMax, source: 'custom', profile: settings.guidelineProfile };
  return getGuidelineTreatmentTarget(settings.guidelineProfile, getPatientAge(settings));
}

export function formatTreatmentTarget(target: TreatmentTargetDefinition): string {
  if (target.systolicMin === undefined || target.diastolicMin === undefined) return `<${target.systolicMax + 1}/${target.diastolicMax + 1}`;
  return `${target.systolicMin}–${target.systolicMax}/${target.diastolicMin}–${target.diastolicMax}`;
}

export function assessTreatmentTarget(systolic: number, diastolic: number, settings: AppSettings): TreatmentTargetAssessment {
  const target = getTreatmentTarget(settings);
  const below = (target.systolicMin !== undefined && systolic < target.systolicMin) || (target.diastolicMin !== undefined && diastolic < target.diastolicMin);
  const above = systolic > target.systolicMax || diastolic > target.diastolicMax;
  const status: TreatmentTargetStatus = below && above ? 'mixed' : below ? 'below' : above ? 'above' : 'within';
  return { status, target, targetLabel: formatTreatmentTarget(target) };
}
