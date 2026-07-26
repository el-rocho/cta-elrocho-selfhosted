import type { BloodPressureReading, ArmPosition } from '../types/bloodPressure';

/**
 * Parsea el contenido de un archivo CSV y devuelve un array de lecturas normalizadas.
 */
export function parseCSVData(csvText: string): Omit<BloodPressureReading, 'id'>[] {
  // Limpiar BOM UTF-8 y normalizar saltos de línea
  const cleanText = csvText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleanText.split('\n').filter((l) => l.trim().length > 0);

  if (lines.length === 0) return [];

  // Detectar delimitador (; o ,)
  const delimiter = cleanText.includes(';') ? ';' : ',';

  // Separar columnas respetando comillas simples/dobles
  const splitLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim().replace(/^["']|["']$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim().replace(/^["']|["']$/g, ''));
    return result;
  };

  const headers = splitLine(lines[0]).map((h) => h.toLowerCase().trim());

  // Buscar índices de columnas según los encabezados
  let dateIdx = headers.findIndex((h) => h.includes('fecha') || h.includes('date') || h.includes('timestamp'));
  let timeIdx = headers.findIndex((h) => h.includes('hora') || h.includes('time'));
  let sysIdx = headers.findIndex(
    (h) => h.includes('sistólica') || h.includes('sistolica') || h.includes('sys') || h.includes('máxima')
  );
  let diaIdx = headers.findIndex(
    (h) => h.includes('diastólica') || h.includes('diastolica') || h.includes('dia') || h.includes('mínima')
  );
  let pulseIdx = headers.findIndex(
    (h) => h.includes('pulsacion') || h.includes('pulso') || h.includes('ppm') || h.includes('bpm') || h.includes('heart')
  );
  let armIdx = headers.findIndex((h) => h.includes('brazo') || h.includes('arm'));
  let notesIdx = headers.findIndex((h) => h.includes('nota') || h.includes('note') || h.includes('comentario'));

  const hasHeaderMatch = sysIdx !== -1 && diaIdx !== -1;
  const startLineIdx = hasHeaderMatch ? 1 : 0;

  // Fallback a posiciones por defecto del CSV propio si no hay coincidencias claras
  if (!hasHeaderMatch) {
    dateIdx = 0;
    timeIdx = 1;
    sysIdx = 2;
    diaIdx = 3;
    pulseIdx = 4;
    armIdx = 5;
    notesIdx = 9; // En la app propia las notas están en col 9
  }

  const readings: Omit<BloodPressureReading, 'id'>[] = [];

  for (let i = startLineIdx; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    if (cols.length < 3) continue;

    const rawSys = parseInt(cols[sysIdx], 10);
    const rawDia = parseInt(cols[diaIdx], 10);
    const rawPulse = pulseIdx !== -1 && cols[pulseIdx] ? parseInt(cols[pulseIdx], 10) : 72;

    if (isNaN(rawSys) || isNaN(rawDia) || rawSys <= rawDia || rawSys < 50 || rawSys > 260) {
      continue; // Ignorar filas no numéricas o con encabezado
    }

    // Procesar Fecha y Hora
    let rawDateStr = dateIdx !== -1 ? cols[dateIdx] : new Date().toISOString().split('T')[0];
    let rawTimeStr = timeIdx !== -1 ? cols[timeIdx] : '12:00';

    const timestamp = parseDateTimeString(rawDateStr, rawTimeStr);

    // Procesar Brazo
    const rawArm = armIdx !== -1 ? cols[armIdx]?.toLowerCase() : '';
    const arm: ArmPosition = rawArm.includes('der') || rawArm.includes('right') ? 'right' : 'left';

    // Procesar Notas
    const notes = notesIdx !== -1 && cols[notesIdx] ? cols[notesIdx].trim() : undefined;

    readings.push({
      timestamp,
      systolic: rawSys,
      diastolic: rawDia,
      heartRate: isNaN(rawPulse) ? 72 : rawPulse,
      arm,
      notes: notes || undefined,
    });
  }

  return readings;
}

/**
 * Convierte cadenas de fecha (ej. 21/07/2026, 2026-07-21) y hora (ej. 10:30) en ISO string
 */
function parseDateTimeString(dateStr: string, timeStr: string): string {
  try {
    let year = 2026;
    let month = 1;
    let day = 1;

    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts[0].length === 4) {
        // YYYY/MM/DD
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        day = parseInt(parts[2], 10);
      } else {
        // DD/MM/YYYY
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        year = parseInt(parts[2], 10);
      }
    } else if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        day = parseInt(parts[2], 10);
      } else {
        // DD-MM-YYYY
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        year = parseInt(parts[2], 10);
      }
    }

    let hours = 12;
    let minutes = 0;
    if (timeStr && timeStr.includes(':')) {
      const tParts = timeStr.split(':');
      hours = parseInt(tParts[0], 10);
      minutes = parseInt(tParts[1], 10);
    }

    const d = new Date(year, month - 1, day, isNaN(hours) ? 12 : hours, isNaN(minutes) ? 0 : minutes);
    if (isNaN(d.getTime())) {
      return new Date().toISOString();
    }
    return d.toISOString();
  } catch (error) {
    return new Date().toISOString();
  }
}
