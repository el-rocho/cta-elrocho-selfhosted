import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHealthHandler } from './health.js';

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

afterEach(() => {
  vi.restoreAllMocks();
});

describe('server health handler', () => {
  it('reports healthy only after checking the database', async () => {
    const get = vi.fn().mockResolvedValue({ ok: 1 });
    const handler = createHealthHandler(async () => ({ get }));
    const response = createResponse();

    await handler({}, response);

    expect(get).toHaveBeenCalledWith('SELECT 1 AS ok');
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('returns 503 without exposing internal errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = createHealthHandler(async () => {
      throw new Error('database path');
    });
    const response = createResponse();

    await handler({}, response);

    expect(response.statusCode).toBe(503);
    expect(response.body).toEqual({ status: 'unavailable' });
  });
});
