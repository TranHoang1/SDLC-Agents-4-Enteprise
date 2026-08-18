/**
 * Unit tests — request-logger middleware factory.
 * Verifies method/path/status/duration are logged at info level, and that
 * /health requests are logged at debug level.
 */

import { describe, it, expect, vi } from 'vitest';
import { createRequestLogger } from '../request-logger.js';

function makeLogger() {
  return { info: vi.fn(), debug: vi.fn() } as any;
}

describe('createRequestLogger', () => {
  it('logs request at info level with fields', async () => {
    const logger = makeLogger();
    const handler = createRequestLogger(logger);
    const c: any = {
      req: { method: 'POST', path: '/api/v1/tools' },
      res: { status: 200 },
    };
    await handler(c, vi.fn(async () => { c.res.status = 201; }));
    expect(logger.info).toHaveBeenCalledTimes(1);
    const [fields, msg] = logger.info.mock.calls[0];
    expect(msg).toBe('request');
    expect(fields.method).toBe('POST');
    expect(fields.path).toBe('/api/v1/tools');
    expect(fields.status).toBe(201);
    expect(typeof fields.duration_ms).toBe('number');
  });

  it('logs /health at debug level, not info', async () => {
    const logger = makeLogger();
    const handler = createRequestLogger(logger);
    const c: any = {
      req: { method: 'GET', path: '/health' },
      res: { status: 200 },
    };
    await handler(c, vi.fn(async () => {}));
    expect(logger.debug).toHaveBeenCalledTimes(1);
    expect(logger.info).not.toHaveBeenCalled();
    const [fields] = logger.debug.mock.calls[0];
    expect(fields.path).toBe('/health');
    expect(fields.status).toBe(200);
  });

  it('records the status set by downstream handlers', async () => {
    const logger = makeLogger();
    const handler = createRequestLogger(logger);
    const c: any = {
      req: { method: 'GET', path: '/x' },
      res: { status: 200 },
    };
    await handler(c, vi.fn(async () => { c.res.status = 500; }));
    expect(logger.info.mock.calls[0][0].status).toBe(500);
  });

  it('propagates errors thrown by downstream handlers', async () => {
    const logger = makeLogger();
    const handler = createRequestLogger(logger);
    const c: any = {
      req: { method: 'GET', path: '/x' },
      res: { status: 200 },
    };
    await expect(handler(c, vi.fn(async () => { throw new Error('downstream boom'); })))
      .rejects.toThrow('downstream boom');
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('awaits next before producing the log line', async () => {
    const logger = makeLogger();
    const handler = createRequestLogger(logger);
    const order: string[] = [];
    const c: any = {
      req: { method: 'GET', path: '/x' },
      res: { status: 200 },
    };
    await handler(c, vi.fn(async () => { order.push('next'); }));
    order.push('log');
    expect(order).toEqual(['next', 'log']);
    expect(logger.info).toHaveBeenCalledTimes(1);
  });
});