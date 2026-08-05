export interface ServerSystemStatus {
  status: 'ok';
  checkedAt: string;
  version: string;
  uptimeSeconds: number;
  connectionLatencyMs: number;
  database: { status: 'ok'; responseTimeMs: number; sizeBytes: number | null };
  cpu: { scope: 'process'; usagePercent: number | null; logicalCores: number } | null;
  memory: {
    scope: 'container' | 'process';
    usedBytes: number;
    limitBytes: number | null;
    usagePercent: number | null;
    processRssBytes: number;
    heapUsedBytes: number;
    heapTotalBytes: number;
  } | null;
  disk: {
    scope: 'dataVolume';
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    usagePercent: number | null;
  } | null;
  api: {
    requestsLastMinute: number;
    averageResponseTimeMs: number;
    receivedBytesLastMinute: number;
    sentBytesLastMinute: number;
  };
  backup: { lastAt: string | null; lastFullAt: string | null };
}

export type ServerStatusErrorCode = 'unsupported-version' | 'unavailable';

export class ServerStatusRequestError extends Error {
  code: ServerStatusErrorCode;

  constructor(code: ServerStatusErrorCode) {
    super(code);
    this.name = 'ServerStatusRequestError';
    this.code = code;
  }
}

function getStatusUrl(healthUrl: string): string {
  return healthUrl.replace(/\/health$/, '/admin/system-status');
}

export async function getAdminServerStatus(
  healthUrl: string,
  timeoutMs = 6_000,
): Promise<ServerSystemStatus> {
  if (!healthUrl) throw new ServerStatusRequestError('unavailable');
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();
  const token = localStorage.getItem('cta_session_token');
  const headers: Record<string, string> = {};
  if (token) headers['x-session-token'] = token;

  try {
    const response = await fetch(`${getStatusUrl(healthUrl)}?fresh=${Date.now()}`, {
      headers,
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
    });
    if (response.status === 404) throw new ServerStatusRequestError('unsupported-version');
    if (!response.ok) throw new ServerStatusRequestError('unavailable');
    const contentType = response.headers?.get?.('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new ServerStatusRequestError('unsupported-version');
    }
    const data = await response.json() as Omit<ServerSystemStatus, 'connectionLatencyMs'>;
    return { ...data, connectionLatencyMs: Math.round(performance.now() - startedAt) };
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}
