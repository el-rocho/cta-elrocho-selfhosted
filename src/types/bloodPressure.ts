/**
 * Modelos de datos para el seguimiento de la tensión arterial
 */

export type ArmPosition = 'left' | 'right';
export type PatientSex = 'masculino' | 'femenino' | '';
export type InputMode = 'keyboard' | 'wheel';

export interface BloodPressureReading {
  id: string;
  timestamp: string; // Formato ISO
  systolic: number; // Tensión sistólica (mmHg)
  diastolic: number; // Tensión diastólica (mmHg)
  heartRate: number; // Pulsaciones por minuto (ppm)
  arm: ArmPosition; // Brazo utilizado ('left' = Izquierdo, 'right' = Derecho)
  notes?: string; // Notas adicionales del usuario
  sessionId?: string; // ID de sesión si pertenece a un conjunto de lecturas continuas
  // Solo es true cuando una PP < 25 o > 60 mmHg fue confirmada por el usuario.
  pulsePressureWarningConfirmed?: boolean;
  // Foto del contexto clínico en el momento de la toma. Es opcional solo para importar datos antiguos.
  takesAntihypertensiveMedication?: boolean;
}

export interface BloodPressureSession {
  id: string;
  timestamp: string; // Hora de la sesión (primera lectura)
  readings: BloodPressureReading[];
  averageSystolic: number;
  averageDiastolic: number;
  averageHeartRate: number;
  discardedCount: number; // Número de tomas iniciales mas altas descartadas por sesgo de bata blanca
  arm: ArmPosition;
  notes?: string;
}

export type BackupFrequency = 'disabled' | 'daily' | 'weekly' | 'monthly';
export type LanguageOption = 'es' | 'en';
export type GuidelineProfile = 'esc-2024' | 'aha-acc-2025' | 'ish-2020';
export type TreatmentTargetMode = 'guideline' | 'custom';

export interface AppSettings {
  language: LanguageOption; // Idioma de la aplicación ('es' / 'en')
  enableWhiteCoatFilter: boolean; // Activar/desactivar filtro de bata blanca
  whiteCoatIntervalMinutes: number; // Intervalo de tiempo máximo entre tomas (3, 5 o 10 min)
  defaultArm: ArmPosition; // Brazo predeterminado ('left' / 'right')
  preferredInputMode: InputMode; // Modo de introducción de datos ('keyboard' / 'wheel')
  guidelineProfile: GuidelineProfile;
  treatmentTargetMode: TreatmentTargetMode;
  customTargetSystolicMin: number;
  customTargetSystolicMax: number;
  customTargetDiastolicMin: number;
  customTargetDiastolicMax: number;
  
  // Perfil del paciente
  patientName?: string;
  patientSex?: PatientSex;
  patientAge?: number | '';
  patientBirthDate?: string; // Formato YYYY-MM-DD
  takesAntihypertensiveMedication: boolean;

  // Recordatorios para crear copias completas
  backupFrequency: BackupFrequency;
  backupFolder: string;
  // Marca heredada de las antiguas copias CSV.
  lastBackupTimestamp?: string;
  lastFullBackupTimestamp?: string;
}

export interface ExportReportOptions {
  patientName?: string;
  patientSex?: PatientSex;
  patientAge?: number | '';
  patientBirthDate?: string;
  takesAntihypertensiveMedication?: boolean;
  guidelineProfile?: GuidelineProfile;
  reportNotes?: string;
  hidePatientData?: boolean;
}

export type HealthSeverity = 'low' | 'normal' | 'elevated' | 'hypertension' | 'stage1' | 'stage2' | 'belowThreshold' | 'aboveThreshold' | 'extreme';
export type HealthCulprit = 'none' | 'systolic' | 'diastolic' | 'both';
export type HealthDirection = 'low' | 'neutral' | 'high' | 'extreme';
export type HealthColorRole = 'blue' | 'green' | 'yellow' | 'orange' | 'red';

export interface HealthCategoryInfo {
  key: HealthSeverity;
  guidelineProfile: GuidelineProfile;
  direction: HealthDirection;
  colorRole: HealthColorRole;
  rank: number;
  name: string;
  description: string;
  colorHex: string;
  badgeBg: string;
  badgeText: string;
}

export type HealthAlertKey =
  | 'extremeHighPressure'
  | 'lowBloodPressure'
  | 'narrowPulsePressure'
  | 'widePulsePressure'
  | 'bradycardia'
  | 'tachycardia'
  | 'hypotensionTachycardia'
  | 'hypertensionTachycardia';

export type HealthAlertLevel = 'info' | 'caution' | 'warning' | 'urgent';
export type HealthAlertScope = 'measurement' | 'safety';

export interface HealthAlertInfo {
  key: HealthAlertKey;
  level: HealthAlertLevel;
  scope: HealthAlertScope;
  name: string;
  description: string;
  colorHex: string;
  badgeBg: string;
  badgeText: string;
}

export interface HealthAssessment {
  category: HealthCategoryInfo;
  alerts: HealthAlertInfo[];
  safetyAlerts: HealthAlertInfo[];
  pulsePressure: number;
  culprit: HealthCulprit;
}

export type DateFilterPreset = 'all' | '7days' | '30days' | '90days' | 'custom';

export interface DateRange {
  preset: DateFilterPreset;
  startDate?: string;
  endDate?: string;
}

export type UserRole = 'admin' | 'user';

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  sex?: PatientSex;
  birth_date?: string;
  totp_enabled: boolean;
  created_at: string;
}

export interface AuthStatusResponse {
  hasAdmin: boolean;
  userCount: number;
  user: AuthUser | null;
}

