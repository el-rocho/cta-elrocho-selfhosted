import type { AuthStatusResponse, AuthUser, PatientSex } from '../types/bloodPressure';
import { guardUnauthorized } from './sessionGuard';

let freshRequestSequence = 0;

function freshApiUrl(path: string): string {
  freshRequestSequence += 1;
  return `${path}?fresh=${Date.now()}-${freshRequestSequence}`;
}

function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extraHeaders };
  const token = localStorage.getItem('cta_session_token');
  if (token) {
    headers['x-session-token'] = token;
  }
  return headers;
}

function saveToken(token?: string) {
  if (token) {
    localStorage.setItem('cta_session_token', token);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAuthUser(value: unknown): value is AuthUser {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' && value.id.length > 0
    && typeof value.username === 'string' && value.username.length > 0
    && typeof value.name === 'string'
    && (value.role === 'admin' || value.role === 'user')
    && (value.sex === '' || value.sex === 'masculino' || value.sex === 'femenino')
    && typeof value.birth_date === 'string'
    && typeof value.totp_enabled === 'boolean'
    && typeof value.created_at === 'string';
}

function parseAuthStatus(value: unknown): AuthStatusResponse {
  if (!isRecord(value)
    || typeof value.hasAdmin !== 'boolean'
    || !Number.isInteger(value.userCount)
    || (value.userCount as number) < 0
    || (value.user !== null && !isAuthUser(value.user))) {
    throw new Error('Respuesta inválida del estado de autenticación');
  }
  return value as unknown as AuthStatusResponse;
}

export async function getAuthStatus(): Promise<AuthStatusResponse> {
  const res = await fetch(freshApiUrl('/api/auth/status'), {
    headers: getAuthHeaders(),
    credentials: 'include',
    cache: 'no-store',
  });
  guardUnauthorized(res);
  if (!res.ok) throw new Error('Error al consultar estado de autenticación');
  return parseAuthStatus(await res.json());
}

export interface SessionCheck {
  reachable: boolean;
  user: AuthUser | null;
}

// Comprueba si la sesión sigue viva. Distingue «el servidor no responde»
// (no se toca la sesión) de «el servidor responde y no hay usuario» (sesión
// revocada o caducada), que es lo que debe devolver al usuario al acceso.
export async function checkCurrentSession(): Promise<SessionCheck> {
  try {
    const res = await fetch(freshApiUrl('/api/auth/status'), {
      headers: getAuthHeaders(),
      credentials: 'include',
      cache: 'no-store',
    });
    if (!res.ok) return { reachable: false, user: null };
    const data = (await res.json()) as AuthStatusResponse;
    return { reachable: true, user: data.user ?? null };
  } catch (err) {
    console.error('Error al comprobar la sesión actual:', err);
    return { reachable: false, user: null };
  }
}

export async function setupAdmin(payload: {
  username: string;
  name: string;
  password: string;
  sex?: PatientSex;
  birthDate?: string;
}): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
  try {
    const res = await fetch('/api/auth/setup-admin', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error || 'Error al crear administrador inicial' };
    saveToken(data.token);
    return { success: true, user: data.user };
  } catch {
    return { success: false, error: 'Error de conexión con el servidor' };
  }
}

export async function login(payload: { username: string; password: string }): Promise<{
  success: boolean;
  requires2FA?: boolean;
  tempToken?: string;
  user?: AuthUser;
  error?: string;
}> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error || 'Error al iniciar sesión' };

    if (data.requires2FA) {
      return { success: true, requires2FA: true, tempToken: data.tempToken };
    }

    saveToken(data.token);
    return { success: true, user: data.user };
  } catch {
    return { success: false, error: 'Error de conexión con el servidor' };
  }
}

export async function verifyLoginTotp(payload: { tempToken: string; code: string }): Promise<{
  success: boolean;
  user?: AuthUser;
  error?: string;
}> {
  try {
    const res = await fetch('/api/auth/login/totp', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error || 'Código 2FA incorrecto' };
    saveToken(data.token);
    return { success: true, user: data.user };
  } catch {
    return { success: false, error: 'Error de conexión con el servidor' };
  }
}

export async function logout(): Promise<void> {
  const headers = getAuthHeaders();
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers,
      credentials: 'include',
    });
  } catch (err) {
    console.error('Error al cerrar sesión:', err);
  } finally {
    localStorage.removeItem('cta_session_token');
  }
}

// 2FA Setup & Verification
export async function setupTotp(): Promise<{ secret?: string; qrCodeDataUrl?: string; error?: string }> {
  try {
    const res = await fetch('/api/auth/totp/setup', {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    const data = await res.json();
  guardUnauthorized(res);
    if (!res.ok) {
      return { error: data.error || `Error (${res.status}): ${res.statusText}` };
    }
    return data;
  } catch (err: any) {
    console.error('Error al solicitar setup 2FA:', err);
    return { error: err.message || 'Error de conexión con el servidor' };
  }
}

export async function verifyAndEnableTotp(code: string): Promise<{ success: boolean; recoveryCodes?: string[]; sessionsRevoked?: boolean; error?: string }> {
  try {
    const res = await fetch('/api/auth/totp/verify', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
  guardUnauthorized(res);
    if (!res.ok) return { success: false, error: data.error || 'Error al verificar 2FA' };
    return { success: true, recoveryCodes: data.recoveryCodes, sessionsRevoked: data.sessionsRevoked === true };
  } catch {
    return { success: false, error: 'Error de conexión' };
  }
}

export async function disableTotp(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/totp/disable', {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
    });
  guardUnauthorized(res);
    return res.ok;
  } catch {
    return false;
  }
}

// Administración de usuarios (Solo Admin)
export async function listUsers(): Promise<AuthUser[]> {
  try {
    const res = await fetch(freshApiUrl('/api/users'), {
      headers: getAuthHeaders(),
      credentials: 'include',
      cache: 'no-store',
    });
  guardUnauthorized(res);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function createUser(payload: {
  username: string;
  name: string;
  password: string;
  role: 'admin' | 'user';
  sex?: PatientSex;
  birthDate?: string;
}): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
  guardUnauthorized(res);
    if (!res.ok) return { success: false, error: data.error || 'Error al crear usuario' };
    return { success: true, user: data };
  } catch {
    return { success: false, error: 'Error de conexión' };
  }
}

export async function deleteUser(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/users/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include',
    });
  guardUnauthorized(res);
    return res.ok;
  } catch {
    return false;
  }
}

export async function resetUserPassword(id: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/users/${id}/reset-password`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({ newPassword }),
    });
    const data = await res.json();
  guardUnauthorized(res);
    if (!res.ok) return { success: false, error: data.error || 'Error al restablecer clave' };
    return { success: true };
  } catch {
    return { success: false, error: 'Error de conexión' };
  }
}
