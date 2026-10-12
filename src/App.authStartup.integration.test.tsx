// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from './types/bloodPressure';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const USER: AuthUser = {
  id: 'user-1',
  username: 'admin',
  role: 'admin',
  name: 'Administrador',
  totp_enabled: false,
  created_at: '2026-01-01T00:00:00.000Z',
};

const mocks = vi.hoisted(() => ({
  getAuthStatus: vi.fn(),
  fetchReadings: vi.fn(),
  fetchSettings: vi.fn(),
}));

vi.mock('./services/authService', () => ({
  getAuthStatus: mocks.getAuthStatus,
  checkCurrentSession: vi.fn().mockResolvedValue({ reachable: false, user: null }),
  logout: vi.fn(),
}));

vi.mock('./services/storageService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./services/storageService')>();
  return {
    ...actual,
    fetchReadingsFromServer: mocks.fetchReadings,
    fetchSettingsFromServer: mocks.fetchSettings,
  };
});

vi.mock('./components/LoginModal', () => ({
  LoginModal: ({ hasAdmin }: { hasAdmin: boolean }) => (
    <div data-testid="login-modal">
      {hasAdmin ? 'Iniciar Sesión' : 'Configuración Inicial del Servidor'}
    </div>
  ),
}));

vi.mock('./components/Header', () => ({
  Header: ({ currentUser }: { currentUser: AuthUser | null }) => (
    <div data-testid="active-session">{currentUser ? `session:${currentUser.username}` : 'session:none'}</div>
  ),
}));
vi.mock('./components/ReadingForm', () => ({ ReadingForm: () => null }));
vi.mock('./components/TrendChart', () => ({ TrendChart: () => null }));
vi.mock('./components/TrendInsights', () => ({ TrendInsights: () => null }));
vi.mock('./components/ReadingList', () => ({ ReadingList: () => null }));
vi.mock('./components/EditReadingModal', () => ({ EditReadingModal: () => null }));
vi.mock('./components/LegalNoticeModal', () => ({ LegalNoticeModal: () => null }));
vi.mock('./components/TotpSetupModal', () => ({ TotpSetupModal: () => null }));
vi.mock('./components/UserManagementModal', () => ({ UserManagementModal: () => null }));

import { App } from './App';
import { DEFAULT_SETTINGS } from './services/storageService';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchReadings.mockResolvedValue([]);
  mocks.fetchSettings.mockResolvedValue(DEFAULT_SETTINGS);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function renderApp() {
  await act(async () => {
    root.render(<App />);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function clickRetry() {
  const button = [...container.querySelectorAll('button')]
    .find((item) => item.textContent?.trim() === 'Reintentar');
  if (!button) throw new Error('No se encontró el botón Reintentar');
  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('arranque cuando el estado de autenticación no está disponible', () => {
  it.each([
    ['red', new TypeError('Failed to fetch')],
    ['HTTP', new Error('Error al consultar estado de autenticación')],
    ['JSON inválido', new SyntaxError('Unexpected token')],
    ['respuesta semánticamente inválida', new Error('Respuesta inválida del estado de autenticación')],
  ])('muestra un estado reintentable para un fallo de %s sin montar acceso ni configuración inicial', async (_kind, error) => {
    mocks.getAuthStatus.mockRejectedValue(error);

    await renderApp();

    expect(container.querySelector('[data-testid="auth-startup-error"]')).not.toBeNull();
    expect(container.textContent).toContain('No se pudo conectar con el servidor');
    expect(container.textContent).toContain('Reintentar');
    expect(container.querySelector('[data-testid="login-modal"]')).toBeNull();
    expect(container.textContent).not.toContain('Configuración Inicial del Servidor');
  });

  it('al reintentar recupera la pantalla de acceso correcta', async () => {
    mocks.getAuthStatus
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ hasAdmin: true, userCount: 1, user: null });

    await renderApp();
    await clickRetry();

    expect(mocks.getAuthStatus).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-testid="auth-startup-error"]')).toBeNull();
    expect(container.querySelector('[data-testid="login-modal"]')?.textContent).toContain('Iniciar Sesión');
    expect(container.textContent).not.toContain('Configuración Inicial del Servidor');
  });

  it('al reintentar recupera la sesión activa devuelta por el servidor', async () => {
    mocks.getAuthStatus
      .mockRejectedValueOnce(new SyntaxError('Unexpected token'))
      .mockResolvedValueOnce({ hasAdmin: true, userCount: 1, user: USER });

    await renderApp();
    await clickRetry();

    expect(container.querySelector('[data-testid="auth-startup-error"]')).toBeNull();
    expect(container.querySelector('[data-testid="login-modal"]')).toBeNull();
    expect(container.querySelector('[data-testid="active-session"]')?.textContent).toBe('session:admin');
    expect(mocks.fetchReadings).toHaveBeenCalledTimes(1);
    expect(mocks.fetchSettings).toHaveBeenCalledTimes(1);
  });

  it('muestra la configuración inicial con la respuesta real de un servidor nuevo', async () => {
    mocks.getAuthStatus.mockResolvedValue({ hasAdmin: false, userCount: 0, user: null });

    await renderApp();

    expect(container.querySelector('[data-testid="auth-startup-error"]')).toBeNull();
    expect(container.querySelector('[data-testid="login-modal"]')?.textContent)
      .toContain('Configuración Inicial del Servidor');
  });

  it('permite reintentar una respuesta inválida y llegar a la configuración inicial real', async () => {
    mocks.getAuthStatus
      .mockRejectedValueOnce(new Error('Respuesta inválida del estado de autenticación'))
      .mockResolvedValueOnce({ hasAdmin: false, userCount: 0, user: null });

    await renderApp();
    await clickRetry();

    expect(mocks.getAuthStatus).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-testid="auth-startup-error"]')).toBeNull();
    expect(container.querySelector('[data-testid="login-modal"]')?.textContent)
      .toContain('Configuración Inicial del Servidor');
  });
});
