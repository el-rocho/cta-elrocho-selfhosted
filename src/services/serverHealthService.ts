export const SERVER_HEALTH_TIMEOUT_MS = 3000;

async function fetchWithTimeout(healthUrl: string, timeoutMs: number): Promise<Response | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(healthUrl, {
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function getLegacyHealthUrl(healthUrl: string): string {
  return healthUrl.replace(/\/health$/, '/auth/status');
}

export async function checkServerHealth(
  healthUrl: string,
  timeoutMs = SERVER_HEALTH_TIMEOUT_MS
): Promise<boolean> {
  if (!healthUrl) return false;

  const response = await fetchWithTimeout(healthUrl, timeoutMs);
  if (!response) return false;

  if (response.ok) {
    try {
      const body = await response.json();
      if (body?.status === 'ok') return true;
      if (body?.status === 'unavailable') return false;
    } catch {
      // Los servidores 1.6.0 devuelven el frontend HTML porque aún no tienen /api/health.
    }
  } else if (response.status !== 404 && response.status !== 405) {
    return false;
  }

  const legacyHealthUrl = getLegacyHealthUrl(healthUrl);
  if (legacyHealthUrl === healthUrl) return false;

  const legacyResponse = await fetchWithTimeout(legacyHealthUrl, timeoutMs);
  return Boolean(legacyResponse?.ok);
}
