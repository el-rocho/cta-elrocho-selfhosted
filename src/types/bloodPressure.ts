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

export interface AppSettings {
  language: LanguageOption; // Idioma de la aplicación ('es' / 'en')
  enableWhiteCoatFilter: boolean; // Activar/desactivar filtro de bata blanca
  whiteCoatIntervalMinutes: number; // Intervalo de tiempo máximo entre tomas (ej. 5, 10, 15 min)
  defaultArm: ArmPosition; // Brazo predeterminado ('left' / 'right')
  preferredInputMode: InputMode; // Modo de introducción de datos ('keyboard' / 'wheel')
  
  // Perfil del paciente
  patientName?: string;
  patientSex?: PatientSex;
  patientAge?: number | '';
  patientBirthDate?: string; // Formato YYYY-MM-DD
  takesAntihypertensiveMedication: boolean;

  // Copias de seguridad automáticas CSV
  backupFrequency: BackupFrequency;
  backupFolder: string;
  lastBackupTimestamp?: string;
}

export interface ExportReportOptions {
  patientName?: string;
  patientSex?: PatientSex;
  patientAge?: number | '';
  patientBirthDate?: string;
  takesAntihypertensiveMedication?: boolean;
  reportNotes?: string;
  hidePatientData?: boolean;
}

export type HealthSeverity = 'hypotension' | 'overtreatment' | 'optimal' | 'elevated' | 'hypertension';
export type HealthCulprit = 'none' | 'systolic' | 'diastolic' | 'both';

export interface HealthCategoryInfo {
  key: HealthSeverity;
  name: string;
  description: string;
  colorHex: string;
  badgeBg: string;
  badgeText: string;
}

export type HealthAlertKey =
  | 'lowDiastolic'
  | 'narrowPulsePressure'
  | 'widePulsePressure'
  | 'bradycardia'
  | 'tachycardia'
  | 'hypotensionTachycardia'
  | 'hypertensionTachycardia';

export type HealthAlertLevel = 'info' | 'caution' | 'warning';

export interface HealthAlertInfo {
  key: HealthAlertKey;
  level: HealthAlertLevel;
  name: string;
  description: string;
  colorHex: string;
  badgeBg: string;
  badgeText: string;
}

export interface HealthAssessment {
  category: HealthCategoryInfo;
  alerts: HealthAlertInfo[];
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

