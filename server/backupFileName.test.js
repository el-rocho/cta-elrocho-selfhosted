import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BACKUP_PREFIX,
  buildBackupFileName,
  isSafeBackupSegment,
  normalizeBackupPrefix,
  resolveBackupFilePath,
  sanitizeBackupSegment,
} from './backupFileName.js';

const BACKUPS_DIR = '/srv/cta/data/backups';
const DATE = new Date('2026-10-12T10:20:30.400Z');

describe('backup file names', () => {
  it('keeps the default prefix when the client sends none', () => {
    for (const prefix of [undefined, null, '']) {
      expect(buildBackupFileName({ prefix, username: 'javier', date: DATE }))
        .toBe(`${DEFAULT_BACKUP_PREFIX}_javier_2026-10-12T10-20-30-400Z.csv`);
    }
  });

  it('accepts a simple prefix and keeps it verbatim', () => {
    expect(normalizeBackupPrefix('informe_tension_arterial')).toBe('informe_tension_arterial');
    expect(normalizeBackupPrefix('CTA-2026')).toBe('CTA-2026');
  });

  it('rejects prefixes that could leave the backups directory', () => {
    const hostilePrefixes = [
      '../evil',
      '..%2Fevil',
      '../../etc/cron.d/evil',
      '/etc/evil',
      'backups/../evil',
      'evil\\..\\..\\evil',
      'C:\\Windows\\evil',
      '.',
      '..',
      'evil.txt',
      'con espacio',
      'con\0nulo',
      'con\nsalto',
      'a'.repeat(41),
      'prefijo/',
      '-copia',
      '_copia',
      '--',
    ];
    for (const prefix of hostilePrefixes) {
      expect(() => normalizeBackupPrefix(prefix), `prefix ${JSON.stringify(prefix)}`).toThrowError(
        'El prefijo del nombre de copia no es válido.'
      );
      expect(() => buildBackupFileName({ prefix, username: 'javier', date: DATE })).toThrow();
    }
  });

  it('rejects prefixes that are not strings instead of stringifying them', () => {
    for (const prefix of [42, { toString: () => 'evil' }, ['../evil'], true]) {
      expect(isSafeBackupSegment(prefix)).toBe(false);
      expect(() => normalizeBackupPrefix(prefix)).toThrow();
    }
  });

  it('normalizes stored user names, which may contain any character', () => {
    expect(sanitizeBackupSegment('javier')).toBe('javier');
    expect(sanitizeBackupSegment('josé-antonio')).toBe('jose-antonio');
    expect(sanitizeBackupSegment('../../etc')).toBe('etc');
    expect(sanitizeBackupSegment('a/b\\c')).toBe('a_b_c');
    expect(sanitizeBackupSegment('usuario con espacios')).toBe('usuario_con_espacios');
    expect(sanitizeBackupSegment('')).toBe('usuario');
    expect(sanitizeBackupSegment(null)).toBe('usuario');
    expect(sanitizeBackupSegment('..')).toBe('usuario');
    expect(sanitizeBackupSegment('-copia')).toBe('copia');
    expect(sanitizeBackupSegment('x'.repeat(80))).toHaveLength(40);
    expect(sanitizeBackupSegment(`${'x'.repeat(39)}!!!`)).toBe('x'.repeat(39));
    for (const value of ['javier', '../../etc', 'a/b\\c', '..', '-x', 'x'.repeat(80), '']) {
      expect(isSafeBackupSegment(sanitizeBackupSegment(value))).toBe(true);
    }
  });

  it('always resolves the path inside the backups directory', () => {
    const names = [
      buildBackupFileName({ prefix: undefined, username: '../../etc/passwd', date: DATE }),
      buildBackupFileName({ prefix: 'copia', username: '/root/.ssh/authorized_keys', date: DATE }),
      buildBackupFileName({ prefix: 'copia', username: 'javier', date: DATE }),
    ];
    for (const filename of names) {
      expect(filename).not.toMatch(/[\\/]/);
      const filePath = resolveBackupFilePath(BACKUPS_DIR, filename);
      expect(path.dirname(filePath)).toBe(path.resolve(BACKUPS_DIR));
      expect(path.basename(filePath)).toBe(filename);
    }
  });

  it('refuses to resolve a file outside the backups directory', () => {
    for (const filename of ['../evil.csv', '../../evil.csv', '/etc/evil.csv', 'sub/evil.csv', '..', '']) {
      expect(() => resolveBackupFilePath(BACKUPS_DIR, filename), `filename ${filename}`).toThrow(
        'La copia debe guardarse dentro del directorio de copias.'
      );
    }
  });
});
