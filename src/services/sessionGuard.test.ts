import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyTotpStatusIfAuthenticated,
  guardUnauthorized,
  notifySessionInvalid,
  onSessionInvalid,
  completeTotpChange,
  shouldShowLoginAfterSessionInvalid,
} from './sessionGuard';

describe('vigilancia de la sesión en el cliente', () => {
  let removeItem: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    removeItem = vi.fn();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue('session-test'),
      setItem: vi.fn(),
      removeItem,
    });
  });

  it('avisa a los suscriptores y borra el token guardado', () => {
    const listener = vi.fn();
    const unsubscribe = onSessionInvalid(listener);

    notifySessionInvalid();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(removeItem).toHaveBeenCalledWith('cta_session_token');
    unsubscribe();
  });

  it('deja de avisar tras cancelar la suscripción', () => {
    const listener = vi.fn();
    const unsubscribe = onSessionInvalid(listener);
    unsubscribe();

    notifySessionInvalid();

    expect(listener).not.toHaveBeenCalled();
  });

  it('solo considera caducada la sesión ante un 401', () => {
    const listener = vi.fn();
    const unsubscribe = onSessionInvalid(listener);

    expect(guardUnauthorized({ status: 500 })).toBe(false);
    expect(guardUnauthorized({ status: 200 })).toBe(false);
    expect(listener).not.toHaveBeenCalled();

    expect(guardUnauthorized({ status: 401 })).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('no restaura un usuario después de que otra petición invalidase la sesión', () => {
    expect(applyTotpStatusIfAuthenticated(null, true)).toBeNull();
    expect(applyTotpStatusIfAuthenticated({ id: 'user-1', totp_enabled: false }, true)).toEqual({
      id: 'user-1',
      totp_enabled: true,
    });
  });

  it('mantiene visibles los códigos de recuperación antes de mostrar el acceso', () => {
    expect(shouldShowLoginAfterSessionInvalid(null, true)).toBe(false);
    expect(shouldShowLoginAfterSessionInvalid(null, false)).toBe(true);
    expect(shouldShowLoginAfterSessionInvalid({ id: 'user-1' }, false)).toBe(false);
  });

  it('conserva los códigos tras activar TOTP y abre el acceso al pulsar Finalizar', () => {
    let user: { id: string } | null = { id: 'user-1' };
    const unsubscribe = onSessionInvalid(() => { user = null; });

    expect(shouldShowLoginAfterSessionInvalid(user, true)).toBe(false);
    expect(removeItem).not.toHaveBeenCalled();
    completeTotpChange(false);
    expect(user).not.toBeNull();
    completeTotpChange(true);
    expect(removeItem).toHaveBeenCalledWith('cta_session_token');
    expect(shouldShowLoginAfterSessionInvalid(user, false)).toBe(true);
    unsubscribe();
  });
});
