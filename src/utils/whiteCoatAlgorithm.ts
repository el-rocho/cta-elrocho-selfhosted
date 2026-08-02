import type { BloodPressureReading, BloodPressureSession, AppSettings } from '../types/bloodPressure';
import { DEFAULT_SETTINGS } from '../services/storageService';
import { getReadingMedicationContext } from './healthClassification';

export const WHITE_COAT_INTERVAL_MINUTES = 5;

export function getEffectiveSessionReadings(
  session: BloodPressureSession
): BloodPressureReading[] {
  return session.readings.slice(session.discardedCount);
}

export function getSessionSummaryReading(
  session: BloodPressureSession
): BloodPressureReading | null {
  const effectiveReadings = getEffectiveSessionReadings(session);
  const representativeReading =
    effectiveReadings[effectiveReadings.length - 1] ??
    session.readings[session.readings.length - 1];

  if (!representativeReading) return null;

  return {
    ...representativeReading,
    systolic: session.averageSystolic,
    diastolic: session.averageDiastolic,
    heartRate: session.averageHeartRate,
  };
}

/**
 * Agrupa una lista de lecturas en sesiones de medición continua respetando las opciones configuradas.
 * Aplica las reglas de acomodación versionadas en docs/reglas-clinicas-v1.6.0.md
 * (margen sistólico de 8 mmHg o diastólico de 4 mmHg cuando corresponde).
 */
export function processReadingsIntoSessions(
  readings: BloodPressureReading[],
  settings: AppSettings = DEFAULT_SETTINGS
): {
  sessions: BloodPressureSession[];
  allReadings: BloodPressureReading[];
} {
  if (readings.length === 0) {
    return { sessions: [], allReadings: [] };
  }

  // Copiar antes de ordenar: el cálculo de sesiones no debe modificar el estado
  // ni reutilizar identificadores derivados por una agrupación anterior.
  const sorted = readings
    .map((reading) => ({ ...reading, sessionId: undefined }))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Si el filtro de bata blanca está DESACTIVADO por el usuario, tratamos cada lectura como una sesión individual
  if (!settings.enableWhiteCoatFilter) {
    const individualSessions: BloodPressureSession[] = sorted.map((r) => ({
      id: `session-single-${r.id}`,
      timestamp: r.timestamp,
      readings: [{ ...r }],
      averageSystolic: r.systolic,
      averageDiastolic: r.diastolic,
      averageHeartRate: r.heartRate,
      discardedCount: 0,
      arm: r.arm,
      notes: r.notes,
    }));

    const sessionsDescending = [...individualSessions].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return {
      sessions: sessionsDescending,
      allReadings: sorted,
    };
  }

  // Intervalo fijo entre tomas consecutivas; los valores configurables antiguos se ignoran.
  const sessionThresholdMs = WHITE_COAT_INTERVAL_MINUTES * 60 * 1000;

  const sessionGroups: BloodPressureReading[][] = [];
  let currentGroup: BloodPressureReading[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prevTime = new Date(sorted[i - 1].timestamp).getTime();
    const currTime = new Date(sorted[i].timestamp).getTime();
    const previousMedicationContext = getReadingMedicationContext(
      sorted[i - 1],
      settings.takesAntihypertensiveMedication
    );
    const currentMedicationContext = getReadingMedicationContext(
      sorted[i],
      settings.takesAntihypertensiveMedication
    );

    // Nunca mezclar en una misma media tomas realizadas bajo contextos clínicos distintos.
    if (
      currTime - prevTime <= sessionThresholdMs &&
      previousMedicationContext === currentMedicationContext
    ) {
      currentGroup.push(sorted[i]);
    } else {
      sessionGroups.push(currentGroup);
      currentGroup = [sorted[i]];
    }
  }
  if (currentGroup.length > 0) {
    sessionGroups.push(currentGroup);
  }

  // Procesar cada grupo de tomas consecutivas aplicando los criterios médicos del filtro de bata blanca
  const sessions: BloodPressureSession[] = sessionGroups.map((group, index) => {
    const sessionId = `session-${index}-${group[0].id}`;
    const sessionReadings = group.map((reading) => ({ ...reading, sessionId }));

    let validReadingsForAvg = [...sessionReadings];
    let discardedCount = 0;

    if (sessionReadings.length === 2) {
      // En 2 tomas: Si la 1ª está significativamente elevada respecto a la 2ª (efecto bata blanca inicial), se descarta la 1ª
      if (sessionReadings[0].systolic >= sessionReadings[1].systolic + 8 || sessionReadings[0].diastolic >= sessionReadings[1].diastolic + 4) {
        validReadingsForAvg = [sessionReadings[1]];
        discardedCount = 1;
      }
    } else if (sessionReadings.length === 3) {
      // En 3 tomas: La 1ª toma se descarta siempre, manteniendo 2 tomas válidas para la media
      validReadingsForAvg = sessionReadings.slice(1);
      discardedCount = 1;
    } else if (sessionReadings.length >= 4) {
      // En usuarios muy sensibles el descenso puede prolongarse hasta la cuarta
      // toma o más. Se elimina únicamente el prefijo que siga claramente por
      // encima de las tomas posteriores. Puede quedar una sola toma estable:
      // el resultado de toda la sesión seguirá siendo una única medición.
      for (let i = 0; i < sessionReadings.length - 1; i++) {
        const remainingIfDiscarded = sessionReadings.slice(i + 1);
        const avgSysRemaining = remainingIfDiscarded.reduce((acc, r) => acc + r.systolic, 0) / remainingIfDiscarded.length;
        const avgDiaRemaining = remainingIfDiscarded.reduce((acc, r) => acc + r.diastolic, 0) / remainingIfDiscarded.length;

        if (sessionReadings[i].systolic >= avgSysRemaining + 8 || sessionReadings[i].diastolic >= avgDiaRemaining + 4) {
          validReadingsForAvg = remainingIfDiscarded;
          discardedCount = i + 1;
        } else {
          break;
        }
      }
    }

    const sumSys = validReadingsForAvg.reduce((acc, r) => acc + r.systolic, 0);
    const sumDia = validReadingsForAvg.reduce((acc, r) => acc + r.diastolic, 0);
    const sumPulse = validReadingsForAvg.reduce((acc, r) => acc + r.heartRate, 0);

    const count = validReadingsForAvg.length;
    const notesList = sessionReadings.map((r) => r.notes).filter(Boolean);
    const combinedNotes = notesList.length > 0 ? Array.from(new Set(notesList)).join(' | ') : undefined;

    return {
      id: sessionId,
      timestamp: sessionReadings[0].timestamp,
      readings: sessionReadings,
      averageSystolic: Math.round(sumSys / count),
      averageDiastolic: Math.round(sumDia / count),
      averageHeartRate: Math.round(sumPulse / count),
      discardedCount,
      arm: sessionReadings[sessionReadings.length - 1].arm,
      notes: combinedNotes,
    };
  });

  const sessionsDescending = [...sessions].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return {
    sessions: sessionsDescending,
    allReadings: sorted,
  };
}
