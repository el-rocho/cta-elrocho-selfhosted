import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAuthStatus } from './authService';

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => null),
    removeItem: vi.fn(),
    setItem: vi.fn(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('getAuthStatus', () => {
  const validUser = {
    id: 'user-1',
    username: 'admin',
    name: 'Administrador',
    role: 'admin',
    sex: '',
    birth_date: '',
    totp_enabled: false,
    created_at: '2026-01-01T00:00:00.000Z',
  };

  it('rechaza cuando no se puede conectar con el servidor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(getAuthStatus()).rejects.toThrow('Failed to fetch');
  });

  it('rechaza las respuestas HTTP no satisfactorias', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: vi.fn(),
    }));

    await expect(getAuthStatus()).rejects.toThrow('Error al consultar estado de autenticación');
  });

  it('rechaza una respuesta con JSON inválido', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
    }));

    await expect(getAuthStatus()).rejects.toThrow('Unexpected token');
  });

  it('acepta la respuesta real de un servidor todavía sin administrador', async () => {
    const response = { hasAdmin: false, userCount: 0, user: null };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(response),
    }));

    await expect(getAuthStatus()).resolves.toEqual(response);
  });

  it.each([
    ['un objeto vacío', {}],
    ['hasAdmin con tipo incorrecto', { hasAdmin: 'false', userCount: 0, user: null }],
    ['userCount negativo', { hasAdmin: false, userCount: -1, user: null }],
    ['userCount no entero', { hasAdmin: true, userCount: 1.5, user: null }],
    ['un usuario incompleto', { hasAdmin: true, userCount: 1, user: { id: 'user-1' } }],
    ['un usuario con rol inválido', { hasAdmin: true, userCount: 1, user: { ...validUser, role: 'owner' } }],
    ['un usuario con 2FA no booleano', { hasAdmin: true, userCount: 1, user: { ...validUser, totp_enabled: 1 } }],
  ])('rechaza %s aunque llegue en una respuesta HTTP 2xx', async (_description, payload) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(payload),
    }));

    await expect(getAuthStatus()).rejects.toThrow('Respuesta inválida del estado de autenticación');
  });

  it('acepta un usuario completo devuelto por el endpoint', async () => {
    const response = { hasAdmin: true, userCount: 1, user: validUser };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(response),
    }));

    await expect(getAuthStatus()).resolves.toEqual(response);
  });
});
