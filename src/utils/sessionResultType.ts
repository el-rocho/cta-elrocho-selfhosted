import type { BloodPressureSession, LanguageOption } from '../types/bloodPressure';

export type SessionResultType = 'individual' | 'average' | 'filtered';

export interface SessionResultTypeInfo {
  key: SessionResultType;
  label: string;
  reportCode: string;
  reportLabel: string;
  color: string;
}

const RESULT_TYPE_COLORS: Record<SessionResultType, string> = {
  individual: 'rgba(100,116,139,0.14)',
  average: 'rgba(59,130,246,0.14)',
  filtered: 'rgba(245,158,11,0.16)',
};

export function getSessionResultType(session: BloodPressureSession): SessionResultType {
  if (session.discardedCount > 0) return 'filtered';
  if (session.readings.length > 1) return 'average';
  return 'individual';
}

export function getSessionResultTypeInfo(
  type: SessionResultType,
  lang: LanguageOption = 'es'
): SessionResultTypeInfo {
  const isEn = lang === 'en';
  const labels: Record<SessionResultType, string> = isEn
    ? { individual: 'Individual measurement', average: 'Average of multiple measurements', filtered: 'Filtered average' }
    : { individual: 'Medición individual', average: 'Media de varias mediciones', filtered: 'Media filtrada' };
  const reportCodes: Record<SessionResultType, string> = isEn
    ? { individual: 'I', average: 'A', filtered: 'F' }
    : { individual: 'I', average: 'M', filtered: 'F' };
  const reportLabels: Record<SessionResultType, string> = isEn
    ? { individual: 'Individual measurement', average: 'Average of multiple measurements', filtered: 'Filtered average of multiple measurements' }
    : { individual: 'Medición individual', average: 'Media de varias mediciones', filtered: 'Media filtrada de varias mediciones' };

  return {
    key: type,
    label: labels[type],
    reportCode: reportCodes[type],
    reportLabel: reportLabels[type],
    color: RESULT_TYPE_COLORS[type],
  };
}

export function getSessionResultTypeLegend(lang: LanguageOption = 'es'): SessionResultTypeInfo[] {
  return (['individual', 'average', 'filtered'] as const).map((type) => getSessionResultTypeInfo(type, lang));
}
