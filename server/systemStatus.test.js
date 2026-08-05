import { EventEmitter } from 'events';
import { describe, expect, it, vi } from 'vitest';
import { createApiActivityMonitor, createSystemStatusHandler } from './systemStatus.js';

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

describe('API activity monitor', () => {
  it('summarizes recent API requests without retaining response bodies', () => {
    let timestamp = 1_000;
    const monitor = createApiActivityMonitor(() => timestamp);
    const response = new EventEmitter();
    response.getHeaders = () => ({ 'content-length': '256' });
    const next = vi.fn();

    monitor.middleware({ headers: { 'content-length': '64' } }, response, next);
    timestamp += 25;
    response.emit('finish');

    expect(next).toHaveBeenCalledOnce();
    expect(monitor.snapshot()).toEqual({
      requestsLastMinute: 1,
      averageResponseTimeMs: 25,
      receivedBytesLastMinute: 64,
      sentBytesLastMinute: 256,
    });
  });
});

describe('system status handler', () => {
  it('returns server metrics without exposing filesystem paths', async () => {
    const db = {
      get: vi.fn()
        .mockResolvedValueOnce({ ok: 1 })
        .mockResolvedValueOnce({
          lastBackupTimestamp: '2026-08-01T10:00:00.000Z',
          lastFullBackupTimestamp: null,
        }),
    };
    const handler = createSystemStatusHandler({
      getDatabase: async () => db,
      dataDir: '/private/data',
      databasePath: '/private/data/cta.sqlite',
      appVersion: '1.6.1',
      apiActivity: { snapshot: () => ({ requestsLastMinute: 2 }) },
      sampleCpu: () => ({ scope: 'process', usagePercent: 4.2, logicalCores: 2 }),
      getMemoryStats: async () => ({ scope: 'container', usedBytes: 10, limitBytes: 100, usagePercent: 10 }),
      getDiskStats: async () => ({ scope: 'dataVolume', usedBytes: 20, totalBytes: 100, freeBytes: 80, usagePercent: 20 }),
      getDatabaseSize: async () => 512,
      getUptime: () => 3_661,
      now: () => new Date('2026-08-04T12:00:00.000Z'),
    });
    const response = createResponse();

    await handler({}, response);

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      checkedAt: '2026-08-04T12:00:00.000Z',
      version: '1.6.1',
      uptimeSeconds: 3_661,
      database: { status: 'ok', sizeBytes: 512 },
      cpu: { usagePercent: 4.2 },
      memory: { usagePercent: 10 },
      disk: { usagePercent: 20 },
      api: { requestsLastMinute: 2 },
      backup: { lastAt: '2026-08-01T10:00:00.000Z', lastFullAt: null },
    });
    expect(JSON.stringify(response.body)).not.toContain('/private/data');
  });
});
