import type { BloodPressureReading, BloodPressureSession, AppSettings } from '../types/bloodPressure';
import { DEFAULT_SETTINGS } from '../services/storageService';
import { getReadingMedicationContext } from './healthClassification';

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
 * Agrupa una lista de lecturas en sesiones de mediciÃ³n continua respetando las opciones configuradas.
 * Aplica el filtro mÃ©dico de bata blanca para descartar picos de ansiedad iniciales (15-25 mmHg SistÃ³lica / 5-10 mmHg DiastÃ³lica).
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

  // Ordenar cronolÃ³gicamente ascendente para agrupar
  const sorted = [...readings].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Si el filtro de bata blanca estÃ¡ DESACTIVADO por el usuario, tratamos cada lectura como una sesiÃ³n individual
  if (!settings.enableWhiteCoatFilter) {
    const individualSessions: BloodPressureSession[] = sorted.map((r) => ({
      id: `session-single-${r.id}`,
      timestamp: r.timestamp,
      readings: [r],
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

  // Umbral de tiempo dinÃ¡mico segÃºn la configuraciÃ³n del usuario (en milisegundos) entre tomas consecutivas
  const sessionThresholdMs = (settings.whiteCoatIntervalMinutes || 5) * 60 * 1000;

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

    // Nunca mezclar en una misma media tomas realizadas bajo contextos clÃ­nicos distintos.
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

  // Procesar cada grupo de tomas consecutivas aplicando los criterios mÃ©dicos del filtro de bata blanca
  const sessions: BloodPressureSession[] = sessionGroups.map((group, index) => {
    const sessionId = group[0].sessionId || `session-${index}-${group[0].id}`;

    group.forEach((r) => {
      r.sessionId = sessionId;
    });

    let validReadingsForAvg = [...group];
    let discardedCount = 0;

    if (group.length === 2) {
      // En 2 tomas: Si la 1Âª estÃ¡ significativamente elevada respecto a la 2Âª (efecto bata blanca inicial), se descarta la 1Âª
      if (group[0].systolic >= group[1].systolic + 8 || group[0].diastolic >= group[1].diastolic + 4) {
        validReadingsForAvg = [group[1]];
        discardedCount = 1;
      }
    } else if (group.length === 3) {
      // En 3 tomas: La 1Âª toma se descarta siempre, manteniendo 2 tomas vÃ¡lidas para la media
      validReadingsForAvg = group.slice(1);
      discardedCount = 1;
    } else if (group.length >= 4) {
      // En usuarios muy sensibles el descenso puede prolongarse hasta la cuarta
      // toma o mÃ¡s. Se elimina Ãºnicamente el prefijo que siga claramente por
      // encima de las tomas posteriores. Puede quedar una sola toma estable:
      // el resultado de toda la sesiÃ³n seguirÃ¡ siendo una Ãºnica mediciÃ³n.
      for (let i = 0; i < group.length - 1; i++) {
        const remainingIfDiscarded = group.slice(i + 1);
        const avgSysRemaining = remainingIfDiscarded.reduce((acc, r) => acc + r.systolic, 0) / remainingIfDiscarded.length;
        const avgDiaRemaining = remainingIfDiscarded.reduce((acc, r) => acc + r.diastolic, 0) / remainingIfDiscarded.length;

        if (group[i].systolic >= avgSysRemaining + 8 || group[i].diastolic >= avgDiaRemaining + 4) {
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
    const notesList = group.map((r) => r.notes).filter(Boolean);
    const combinedNotes = notesList.length > 0 ? Array.from(new Set(notesList)).join(' | ') : undefined;

    return {
      id: sessionId,
      timestamp: group[0].timestamp,
      readings: group,
      averageSystolic: Math.round(sumSys / count),
      averageDiastolic: Math.round(sumDia / count),
      averageHeartRate: Math.round(sumPulse / count),
      discardedCount,
      arm: group[group.length - 1].arm,
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
