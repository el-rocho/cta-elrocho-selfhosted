import type { ArmPosition, BloodPressureReading } from '../types/bloodPressure';
import { getReadingValidationError } from './readingValidation';

export type CSVImportFormat = 'native' | 'mytherapy' | 'unknown';

export interface CSVImportOptions {
  defaultArm?: ArmPosition;
}

export interface CSVImportResult {
  format: CSVImportFormat;
  readings: Omit<BloodPressureReading, 'id'>[];
  totalRows: number;
  ignoredRows: number;
  invalidReadings: number;
  incompleteGroups: number;
  shorthandNormalized: number;
}

interface ParsedCSV {
  rows: string[][];
}

interface MyTherapyComponent {
  value: number;
  note?: string;
}

interface MyTherapyGroup {
  timestamp: string;
  systolic: MyTherapyComponent[];
  diastolic: MyTherapyComponent[];
  pulse: MyTherapyComponent[];
}

const DEFAULT_IMPORT_ARM: ArmPosition = 'left';

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function detectDelimiter(csvText: string): string {
  const normalized = csvText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const physicalLines = normalized.split('\n');
  const separatorLine = physicalLines.find((line) => line.trim().toLowerCase().startsWith('sep='));
  if (separatorLine) {
    const declared = separatorLine.trim().slice(4, 5);
    if (declared === ';' || declared === ',') return declared;
  }

  const headerLine = physicalLines.find((line) => {
    const trimmed = line.trim();
    return trimmed.length > 0 && !trimmed.startsWith('#') && !trimmed.toLowerCase().startsWith('sep=');
  }) ?? '';

  let semicolons = 0;
  let commas = 0;
  let inQuotes = false;
  for (let index = 0; index < headerLine.length; index++) {
    const char = headerLine[index];
    if (char === '"') {
      if (inQuotes && headerLine[index + 1] === '"') {
        index++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && char === ';') {
      semicolons++;
    } else if (!inQuotes && char === ',') {
      commas++;
    }
  }
  return semicolons > commas ? ';' : ',';
}

function parseDelimitedRows(csvText: string): ParsedCSV {
  const cleanText = csvText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const delimiter = detectDelimiter(cleanText);
  const parsedRows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quote: string | null = null;

  const finishField = () => {
    row.push(field.trim());
    field = '';
  };

  const finishRow = () => {
    finishField();
    if (row.some((value) => value.trim().length > 0)) parsedRows.push(row);
    row = [];
  };

  for (let index = 0; index < cleanText.length; index++) {
    const char = cleanText[index];
    if (quote) {
      if (char === quote) {
        if (cleanText[index + 1] === quote) {
          field += quote;
          index++;
        } else {
          quote = null;
        }
      } else {
        field += char;
      }
    } else if ((char === '"' || char === "'") && field.length === 0) {
      quote = char;
    } else if (char === delimiter) {
      finishField();
    } else if (char === '\n') {
      finishRow();
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) finishRow();

  const rows = parsedRows.filter((candidate) => {
    const first = candidate[0]?.trim() ?? '';
    return !first.startsWith('#') && !first.toLowerCase().startsWith('sep=');
  });
  return { rows };
}

function findHeader(headers: string[], aliases: string[]): number {
  return headers.findIndex((header) => aliases.some((alias) => header === alias || header.includes(alias)));
}

function parseNumber(value: string | undefined): number {
  if (!value) return Number.NaN;
  return Number(value.trim().replace(',', '.'));
}

function parseBoolean(value: string | undefined): boolean | undefined {
  const normalized = normalizeText(value ?? '');
  if (['true', '1', 'yes', 'si'].includes(normalized)) return true;
  if (['false', '0', 'no'].includes(normalized)) return false;
  return undefined;
}

function parseDateTimeString(dateValue: string, timeValue = ''): string | null {
  const combined = `${dateValue.trim()} ${timeValue.trim()}`.trim();
  const yearFirst = combined.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/
  );
  const dayFirst = combined.match(
    /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/
  );
  const match = yearFirst ?? dayFirst;
  if (!match) return null;

  const year = Number(yearFirst ? match[1] : match[3]);
  const month = Number(match[2]);
  const day = Number(yearFirst ? match[3] : match[1]);
  const hours = Number(match[4] ?? 12);
  const minutes = Number(match[5] ?? 0);
  const seconds = Number(match[6] ?? 0);
  const date = new Date(year, month - 1, day, hours, minutes, seconds);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hours ||
    date.getMinutes() !== minutes
  ) {
    return null;
  }
  return date.toISOString();
}

function isMyTherapyHeader(headers: string[]): boolean {
  const actualDateIdx = findHeader(headers, ['actual_date', 'actualdate', 'fecha_real']);
  const typeIdx = findHeader(headers, ['type', 'tipo']);
  const nameIdx = findHeader(headers, ['name', 'nombre', 'measurement_name']);
  const valueIdx = findHeader(headers, ['value', 'valor', 'result']);
  return actualDateIdx !== -1 && typeIdx !== -1 && nameIdx !== -1 && valueIdx !== -1;
}

function classifyMyTherapyComponent(name: string): 'systolic' | 'diastolic' | 'pulse' | null {
  const normalized = normalizeText(name);
  if (normalized.includes('sistol') || normalized.includes('systolic')) return 'systolic';
  if (normalized.includes('diastol') || normalized.includes('diastolic')) return 'diastolic';
  if (
    normalized.includes('frecuencia_cardiaca') ||
    normalized.includes('heart_rate') ||
    normalized.includes('resting_heart') ||
    normalized === 'pulse' ||
    normalized === 'pulso'
  ) {
    return 'pulse';
  }
  return null;
}

function isAcceptedMeasurementType(value: string): boolean {
  const normalized = normalizeText(value);
  return normalized === 'measurement' || normalized === 'medicion' || normalized === 'measure';
}

function isAcceptedStatus(value: string | undefined): boolean {
  if (!value || value.trim().length === 0) return true;
  const normalized = normalizeText(value);
  return ['confirmed', 'confirmado', 'confirmada', 'completed', 'completado', 'completada'].includes(normalized);
}

function normalizeShorthandValues(
  systolic: number,
  diastolic: number,
  pulse: number
): { systolic: number; diastolic: number; pulse: number; normalized: boolean } {
  const originalError = getReadingValidationError({ systolic, diastolic, heartRate: pulse });
  if (!originalError) return { systolic, diastolic, pulse, normalized: false };

  const candidateSystolic = systolic > 0 && systolic < 30 ? systolic * 10 : systolic;
  const candidateDiastolic = diastolic > 0 && diastolic < 30 ? diastolic * 10 : diastolic;
  const candidatePulse = pulse > 0 && pulse < 30 ? pulse * 10 : pulse;
  const candidateError = getReadingValidationError({
    systolic: candidateSystolic,
    diastolic: candidateDiastolic,
    heartRate: candidatePulse,
  });

  if (candidateError) return { systolic, diastolic, pulse, normalized: false };
  return {
    systolic: candidateSystolic,
    diastolic: candidateDiastolic,
    pulse: candidatePulse,
    normalized: candidateSystolic !== systolic || candidateDiastolic !== diastolic || candidatePulse !== pulse,
  };
}

function joinNotes(...notes: Array<string | undefined>): string | undefined {
  const unique = [...new Set(notes.map((note) => note?.trim()).filter((note): note is string => Boolean(note)))];
  return unique.length > 0 ? unique.join(' | ') : undefined;
}

function parseMyTherapyCSV(
  rows: string[][],
  headers: string[],
  options: CSVImportOptions
): CSVImportResult {
  const actualDateIdx = findHeader(headers, ['actual_date', 'actualdate', 'fecha_real']);
  const typeIdx = findHeader(headers, ['type', 'tipo']);
  const nameIdx = findHeader(headers, ['name', 'nombre', 'measurement_name']);
  const valueIdx = findHeader(headers, ['value', 'valor', 'result']);
  const statusIdx = findHeader(headers, ['status', 'estado']);
  const noteIdx = findHeader(headers, ['note', 'nota', 'comentario']);
  const groups = new Map<string, MyTherapyGroup>();
  let ignoredRows = 0;

  for (const cols of rows.slice(1)) {
    const componentType = classifyMyTherapyComponent(cols[nameIdx] ?? '');
    if (!isAcceptedMeasurementType(cols[typeIdx] ?? '') || !componentType || !isAcceptedStatus(cols[statusIdx])) {
      ignoredRows++;
      continue;
    }

    const timestamp = cols[actualDateIdx]?.trim() ?? '';
    const value = parseNumber(cols[valueIdx]);
    if (!timestamp || !Number.isFinite(value)) {
      ignoredRows++;
      continue;
    }

    let group = groups.get(timestamp);
    if (!group) {
      group = { timestamp, systolic: [], diastolic: [], pulse: [] };
      groups.set(timestamp, group);
    }
    group[componentType].push({ value, note: noteIdx === -1 ? undefined : cols[noteIdx] });
  }

  const readings: Omit<BloodPressureReading, 'id'>[] = [];
  let invalidReadings = 0;
  let incompleteGroups = 0;
  let shorthandNormalized = 0;

  for (const group of groups.values()) {
    const pairCount = Math.min(group.systolic.length, group.diastolic.length, group.pulse.length);
    const largestCount = Math.max(group.systolic.length, group.diastolic.length, group.pulse.length);
    if (pairCount !== largestCount) {
      incompleteGroups++;
      invalidReadings += largestCount - pairCount;
    }

    const baseTimestamp = parseDateTimeString(group.timestamp);
    if (!baseTimestamp) {
      invalidReadings += pairCount;
      continue;
    }

    for (let index = 0; index < pairCount; index++) {
      // MyTherapy puede exportar varias tomas con la misma hora exacta.
      // Separarlas por segundos conserva el orden original también en bases de datos
      // cuyo orden para timestamps idénticos no está garantizado.
      const timestamp = new Date(new Date(baseTimestamp).getTime() + index * 1000).toISOString();
      const systolicComponent = group.systolic[index];
      const diastolicComponent = group.diastolic[index];
      const pulseComponent = group.pulse[index];
      const values = normalizeShorthandValues(
        systolicComponent.value,
        diastolicComponent.value,
        pulseComponent.value
      );

      if (
        getReadingValidationError({
          systolic: values.systolic,
          diastolic: values.diastolic,
          heartRate: values.pulse,
        })
      ) {
        invalidReadings++;
        continue;
      }
      if (values.normalized) shorthandNormalized++;

      readings.push({
        timestamp,
        systolic: values.systolic,
        diastolic: values.diastolic,
        heartRate: values.pulse,
        arm: options.defaultArm ?? DEFAULT_IMPORT_ARM,
        notes: joinNotes(systolicComponent.note, diastolicComponent.note, pulseComponent.note),
        takesAntihypertensiveMedication: undefined,
      });
    }
  }

  return {
    format: 'mytherapy',
    readings,
    totalRows: Math.max(0, rows.length - 1),
    ignoredRows,
    invalidReadings,
    incompleteGroups,
    shorthandNormalized,
  };
}

function parseNativeCSV(
  rows: string[][],
  headers: string[],
  options: CSVImportOptions
): CSVImportResult {
  let dateIdx = findHeader(headers, ['fecha', 'date', 'timestamp']);
  let timeIdx = findHeader(headers, ['hora', 'time']);
  let sysIdx = findHeader(headers, ['sistolica', 'systolic', 'sys', 'maxima']);
  let diaIdx = findHeader(headers, ['diastolica', 'diastolic', 'dia', 'minima']);
  let pulseIdx = findHeader(headers, ['pulsacion', 'pulso', 'pulse', 'ppm', 'bpm', 'heart']);
  let armIdx = findHeader(headers, ['brazo', 'arm']);
  let notesIdx = findHeader(headers, ['notas', 'nota', 'notes', 'note', 'comentario']);
  let ppConfirmedIdx = findHeader(headers, ['pulse_pressure_confirmed', 'presion_pulso_confirmada']);
  let medicationContextIdx = findHeader(headers, ['medication_context', 'contexto_medicacion']);
  const hasHeaderMatch = sysIdx !== -1 && diaIdx !== -1;
  const startLineIdx = hasHeaderMatch ? 1 : 0;

  if (!hasHeaderMatch) {
    dateIdx = 0;
    timeIdx = 1;
    sysIdx = 2;
    diaIdx = 3;
    pulseIdx = 4;
    armIdx = 5;
    notesIdx = 10;
    ppConfirmedIdx = -1;
    medicationContextIdx = -1;
  }

  const readings: Omit<BloodPressureReading, 'id'>[] = [];
  let invalidReadings = 0;
  for (const cols of rows.slice(startLineIdx)) {
    const systolic = parseNumber(cols[sysIdx]);
    const diastolic = parseNumber(cols[diaIdx]);
    const parsedPulse = pulseIdx !== -1 && cols[pulseIdx] ? parseNumber(cols[pulseIdx]) : 72;
    const heartRate = Number.isFinite(parsedPulse) ? parsedPulse : 72;
    if (getReadingValidationError({ systolic, diastolic, heartRate })) {
      invalidReadings++;
      continue;
    }

    const fallbackDate = new Date().toISOString().slice(0, 10);
    const timestamp = parseDateTimeString(
      dateIdx !== -1 ? cols[dateIdx] ?? fallbackDate : fallbackDate,
      timeIdx !== -1 ? cols[timeIdx] ?? '12:00' : '12:00'
    );
    if (!timestamp) {
      invalidReadings++;
      continue;
    }

    const rawArm = armIdx !== -1 ? normalizeText(cols[armIdx] ?? '') : '';
    const arm: ArmPosition = rawArm.includes('der') || rawArm.includes('right')
      ? 'right'
      : rawArm.includes('izq') || rawArm.includes('left')
        ? 'left'
        : options.defaultArm ?? DEFAULT_IMPORT_ARM;
    const notes = notesIdx !== -1 && cols[notesIdx] ? cols[notesIdx].trim() : undefined;

    readings.push({
      timestamp,
      systolic,
      diastolic,
      heartRate,
      arm,
      notes: notes || undefined,
      pulsePressureWarningConfirmed: parseBoolean(cols[ppConfirmedIdx]) || undefined,
      takesAntihypertensiveMedication: parseBoolean(cols[medicationContextIdx]),
    });
  }

  return {
    format: readings.length > 0 || hasHeaderMatch ? 'native' : 'unknown',
    readings,
    totalRows: Math.max(0, rows.length - startLineIdx),
    ignoredRows: 0,
    invalidReadings,
    incompleteGroups: 0,
    shorthandNormalized: 0,
  };
}

/**
 * Detecta el formato y devuelve las lecturas junto con un resumen previo a la importacion.
 */
export function analyzeCSVImport(csvText: string, options: CSVImportOptions = {}): CSVImportResult {
  const { rows } = parseDelimitedRows(csvText);
  if (rows.length === 0) {
    return {
      format: 'unknown',
      readings: [],
      totalRows: 0,
      ignoredRows: 0,
      invalidReadings: 0,
      incompleteGroups: 0,
      shorthandNormalized: 0,
    };
  }

  const headers = rows[0].map(normalizeText);
  if (isMyTherapyHeader(headers)) return parseMyTherapyCSV(rows, headers, options);
  return parseNativeCSV(rows, headers, options);
}

/**
 * Compatibilidad con los consumidores existentes que solo necesitan las lecturas.
 */
export function parseCSVData(
  csvText: string,
  options: CSVImportOptions = {}
): Omit<BloodPressureReading, 'id'>[] {
  return analyzeCSVImport(csvText, options).readings;
}
