// Vigila la validez de la sesión en el cliente.
//
// Cuando el servidor rechaza una petición autenticada con 401 (sesión revocada,
// caducada o invalidada tras un restablecimiento de contraseña), cualquier
// servicio llama a `guardUnauthorized()`; este módulo borra el token guardado y
// avisa a quien esté escuchando, de modo que la interfaz vuelve a la pantalla de
// acceso sin necesidad de recargar la página.

const SESSION_TOKEN_KEY = 'cta_session_token';

type SessionInvalidListener = (showNotification: boolean) => void;

const listeners = new Set<SessionInvalidListener>();

export function onSessionInvalid(listener: SessionInvalidListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifySessionInvalid(showNotification = true): void {
  try {
    localStorage.removeItem(SESSION_TOKEN_KEY);
  } catch (error) {
    console.error('No se pudo limpiar el token de sesión:', error);
  }

  for (const listener of [...listeners]) {
    listener(showNotification);
  }
}

export function applyTotpStatusIfAuthenticated<T extends { totp_enabled: boolean }>(
  user: T | null,
  enabled: boolean
): T | null {
  return user ? { ...user, totp_enabled: enabled } : null;
}

export function shouldShowLoginAfterSessionInvalid(
  user: { id: string } | null,
  recoveryCodesVisible: boolean
): boolean {
  return user === null && !recoveryCodesVisible;
}

export function shouldShowSessionNotification(notification: unknown, recoveryCodesVisible: boolean): boolean {
  return Boolean(notification) && !recoveryCodesVisible;
}

export function completeTotpChange(sessionsRevoked: boolean): void {
  if (sessionsRevoked) notifySessionInvalid(false);
}

export function guardUnauthorized(response: { status: number }): boolean {
  if (response.status !== 401) return false;
  notifySessionInvalid();
  return true;
}
