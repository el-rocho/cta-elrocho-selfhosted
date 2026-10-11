// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://localhost/"}
import { act, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupTotp, verifyAndEnableTotp, disableTotp } from '../services/authService';
import {
  applyTotpStatusIfAuthenticated,
  onSessionInvalid,
  notifySessionInvalid,
  shouldShowSessionNotification,
  shouldShowLoginAfterSessionInvalid,
} from '../services/sessionGuard';
import { TotpSetupModal } from './TotpSetupModal';

vi.mock('../services/authService', () => ({
  setupTotp: vi.fn(),
  verifyAndEnableTotp: vi.fn(),
  disableTotp: vi.fn(),
}));

function SessionWithTotpModal({ initialTotpEnabled = false }: { initialTotpEnabled?: boolean }) {
  const [user, setUser] = useState<{ id: string; totp_enabled: boolean } | null>({
    id: 'test-user', totp_enabled: initialTotpEnabled,
  });
  const [isOpen, setIsOpen] = useState(true);
  const [codesVisible, setCodesVisible] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  useEffect(() => onSessionInvalid((showNotification = true) => {
    setUser(null);
    setNotification(showNotification ? 'Sesión caducada' : null);
  }), []);

  return <>
    {shouldShowSessionNotification(notification, codesVisible) && <div className="toast-modal-overlay">{notification}</div>}
    {shouldShowLoginAfterSessionInvalid(user, codesVisible) && <div data-testid="login-modal">Iniciar sesión</div>}
    {!isOpen && user && <button onClick={() => setIsOpen(true)}>Reabrir TOTP</button>}
    <TotpSetupModal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      isTotpEnabled={Boolean(user?.totp_enabled)}
      onTotpStatusChanged={(enabled) => setUser((current) => applyTotpStatusIfAuthenticated(current, enabled))}
      onRecoveryCodesVisibilityChange={setCodesVisible}
    />
  </>;
}

describe('activación TOTP y cierre de la sesión que la ejecutó', () => {
  let container: HTMLDivElement;
  let root: Root;
  const tokens = new Map<string, string>();

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => tokens.get(key) ?? null,
      setItem: (key: string, value: string) => tokens.set(key, value),
      removeItem: (key: string) => tokens.delete(key),
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    localStorage.setItem('cta_session_token', 'token-de-prueba');
    vi.mocked(setupTotp).mockResolvedValue({ secret: 'TEST-SECRET', qrCodeDataUrl: 'data:image/png;base64,AA==' });
    vi.mocked(verifyAndEnableTotp).mockResolvedValue({
      success: true,
      sessionsRevoked: true,
      recoveryCodes: ['TEST-CODE-1', 'TEST-CODE-2'],
    });
    vi.mocked(disableTotp).mockResolvedValue(true);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    tokens.clear();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('muestra los códigos tras 200 sin 401 concurrente y abre el acceso al pulsar Finalizar', async () => {
    await act(async () => root.render(<SessionWithTotpModal />));
    const input = container.querySelector<HTMLInputElement>('#verify-totp-input');
    expect(input).not.toBeNull();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(input, '000000');
      input!.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(container.textContent).toContain('TEST-CODE-1');
    expect(container.querySelector('[data-testid="login-modal"]')).toBeNull();
    expect(localStorage.getItem('cta_session_token')).toBe('token-de-prueba');

    await act(async () => {
      const finish = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Finalizar'));
      expect(finish).toBeDefined();
      finish!.click();
    });

    expect(container.textContent).not.toContain('TEST-CODE-1');
    expect(container.querySelector('[data-testid="login-modal"]')).not.toBeNull();
    expect(container.querySelector('.toast-modal-overlay')).toBeNull();
    expect(localStorage.getItem('cta_session_token')).toBeNull();
  });

  it('vuelve al acceso inmediatamente al desactivar TOTP sin códigos que guardar', async () => {
    vi.stubGlobal('confirm', () => true);
    await act(async () => root.render(<SessionWithTotpModal initialTotpEnabled />));
    await act(async () => {
      const disable = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Desactivar 2FA'));
      expect(disable).toBeDefined();
      disable!.click();
    });

    expect(disableTotp).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="login-modal"]')).not.toBeNull();
    expect(container.querySelector('.toast-modal-overlay')).toBeNull();
    expect(localStorage.getItem('cta_session_token')).toBeNull();
  });

  it('no permite cerrar durante la verificación para no perder los códigos si la respuesta llega tarde', async () => {
    let resolveVerify!: (result: Awaited<ReturnType<typeof verifyAndEnableTotp>>) => void;
    vi.mocked(verifyAndEnableTotp).mockReturnValue(new Promise((resolve) => { resolveVerify = resolve; }));
    await act(async () => root.render(<SessionWithTotpModal />));
    const input = container.querySelector<HTMLInputElement>('#verify-totp-input')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '000000');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await act(async () => container.querySelector<HTMLButtonElement>('.btn-icon-close')!.click());
    expect(container.querySelector('.totp-setup-modal')).not.toBeNull();

    await act(async () => resolveVerify({ success: true, sessionsRevoked: true, recoveryCodes: ['TEST-CODE-1'] }));
    expect(container.textContent).toContain('TEST-CODE-1');
  });

  it('no muestra la notificación de sesión por encima de códigos ante 401 concurrente', async () => {
    await act(async () => root.render(<SessionWithTotpModal />));
    const input = container.querySelector<HTMLInputElement>('#verify-totp-input')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '000000');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await act(async () => notifySessionInvalid());
    expect(container.textContent).toContain('TEST-CODE-1');
    expect(container.querySelector('.toast-modal-overlay')).toBeNull();
    expect(container.querySelector('[data-testid="login-modal"]')).toBeNull();
    await act(async () => {
      [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Finalizar'))!.click();
    });
    expect(container.querySelector('[data-testid="login-modal"]')).not.toBeNull();
    expect(container.querySelector('.toast-modal-overlay')).toBeNull();
  });

  it('conserva códigos si un 401 llega antes de la respuesta de activación', async () => {
    let resolveVerify!: (result: Awaited<ReturnType<typeof verifyAndEnableTotp>>) => void;
    vi.mocked(verifyAndEnableTotp).mockReturnValue(new Promise((resolve) => { resolveVerify = resolve; }));
    await act(async () => root.render(<SessionWithTotpModal />));
    const input = container.querySelector<HTMLInputElement>('#verify-totp-input')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '000000');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await act(async () => notifySessionInvalid());
    await act(async () => resolveVerify({ success: true, sessionsRevoked: true, recoveryCodes: ['TEST-CODE-1'] }));
    expect(vi.mocked(setupTotp)).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('TEST-CODE-1');
    expect(container.querySelector('.toast-modal-overlay')).toBeNull();
  });

  it('no inicia otro setup si llega un 401 durante la reconfiguración', async () => {
    let resolveVerify!: (result: Awaited<ReturnType<typeof verifyAndEnableTotp>>) => void;
    vi.stubGlobal('confirm', () => true);
    vi.mocked(verifyAndEnableTotp).mockReturnValue(new Promise((resolve) => { resolveVerify = resolve; }));
    await act(async () => root.render(<SessionWithTotpModal initialTotpEnabled />));
    await act(async () => {
      [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Reconfigurar 2FA'))!.click();
    });
    const input = container.querySelector<HTMLInputElement>('#verify-totp-input')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '000000');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await act(async () => notifySessionInvalid());
    await act(async () => resolveVerify({ success: true, sessionsRevoked: true, recoveryCodes: ['TEST-CODE-1'] }));
    expect(vi.mocked(setupTotp)).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('TEST-CODE-1');
    expect(container.querySelector('.toast-modal-overlay')).toBeNull();
  });

  it('ignora un setup anterior si se cierra y se reabre el modal', async () => {
    let oldSetup!: (result: Awaited<ReturnType<typeof setupTotp>>) => void;
    vi.mocked(setupTotp)
      .mockReturnValueOnce(new Promise((resolve) => { oldSetup = resolve; }))
      .mockResolvedValueOnce({ secret: 'NEW-SECRET', qrCodeDataUrl: 'data:image/png;base64,AA==' });
    await act(async () => root.render(<SessionWithTotpModal />));
    await act(async () => container.querySelector<HTMLButtonElement>('.btn-icon-close')!.click());
    await act(async () => {
      [...container.querySelectorAll('button')].find((button) => button.textContent === 'Reabrir TOTP')!.click();
    });
    expect(vi.mocked(setupTotp)).toHaveBeenCalledTimes(1);
    await act(async () => oldSetup({ secret: 'OLD-SECRET', qrCodeDataUrl: 'data:image/png;base64,AA==' }));
    expect(vi.mocked(setupTotp)).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('NEW-SECRET');
    expect(container.textContent).not.toContain('OLD-SECRET');
  });
});
