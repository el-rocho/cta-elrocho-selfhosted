import path from 'path';

export const DEFAULT_BACKUP_PREFIX = 'tension_arterial';
export const BACKUP_FALLBACK_USER = 'usuario';

// Un segmento válido empieza por letra o dígito y sigue con letras, dígitos,
// guiones o guiones bajos: sin barras, sin puntos, sin espacios y sin caracteres
// de control. Al no admitir separadores de ruta, ningún valor puede salir del
// directorio de copias, y ningún nombre empieza por guion (que un script de
// administración podría interpretar como una opción).
const MAX_SEGMENT_LENGTH = 40;
const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/;

function invalidName(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

export function isSafeBackupSegment(value) {
  return typeof value === 'string' && SAFE_SEGMENT.test(value);
}

// El usuario no es un parámetro de esta petición: procede de la base de datos y
// versiones anteriores admitieron cualquier nombre. Por eso se normaliza en
// lugar de rechazarse, para no romper copias de cuentas ya existentes.
export function sanitizeBackupSegment(value, fallback = BACKUP_FALLBACK_USER) {
  if (isSafeBackupSegment(value)) return value;
  const withoutAccents = String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const cleaned = withoutAccents
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .slice(0, MAX_SEGMENT_LENGTH)
    .replace(/^[^A-Za-z0-9]+/, '')
    .replace(/[^A-Za-z0-9]+$/, '');
  return cleaned || fallback;
}

// El prefijo sí es un parámetro del cliente: se rechaza en lugar de
// normalizarse, para que nunca se guarde una copia con un nombre distinto del
// solicitado sin que quien la pide lo sepa.
export function normalizeBackupPrefix(prefix) {
  const resolved = prefix === undefined || prefix === null || prefix === '' ? DEFAULT_BACKUP_PREFIX : prefix;
  if (!isSafeBackupSegment(resolved)) {
    throw invalidName('El prefijo del nombre de copia no es válido.');
  }
  return resolved;
}

export function buildBackupFileName({ prefix, username, date = new Date() }) {
  const safePrefix = normalizeBackupPrefix(prefix);
  const safeUsername = sanitizeBackupSegment(username);
  const timestamp = date.toISOString().replace(/[:.]/g, '-');
  return `${safePrefix}_${safeUsername}_${timestamp}.csv`;
}

// Comprobación final antes de escribir: el archivo debe quedar directamente
// dentro del directorio de copias, sin subdirectorios ni rutas ascendentes.
export function resolveBackupFilePath(backupsDir, filename) {
  const root = path.resolve(backupsDir);
  const filePath = path.resolve(root, filename);
  if (path.dirname(filePath) !== root) {
    throw invalidName('La copia debe guardarse dentro del directorio de copias.');
  }
  return filePath;
}
