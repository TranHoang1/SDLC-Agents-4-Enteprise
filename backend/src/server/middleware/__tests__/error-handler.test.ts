/**
 * Unit tests — error-handler middleware factory.
 * Verifies structured 500 responses, error payload logging, and method/path
 * context captured from the request.
 */

import { describe, it, expect, vi } from 'vitest';
import { createErrorHandler } from '../error-handler.js';

describe('createErrorHandler', () => {
  it('logs the error with path and method context', () => {
    const logger = { error: vi.fn() } as any;
    const handler = createErrorHandler(logger);
    const c: any = {
      req: { path: '/api/v1/tools', method: 'GET' },
      json: vi.fn(() => ({ ok: true })),
    };
    const err = new Error('boom');
    handler(err, c);
    expect(logger.error).toHaveBeenCalledTimes(1);
    const [fields, msg] = logger.error.mock.calls[0];
    expect(msg).toBe('Unhandled error');
    expect(fields.err).toBe(err);
    expect(fields.path).toBe('/api/v1/tools');
    expect(fields.method).toBe('GET');
  });

  it('returns a 500 INTERNAL_ERROR response', () => {
    const logger = { error: vi.fn() } as any;
    const handler = createErrorHandler(logger);
    const c: any = {
      req: { path: '/health', method: 'GET' },
      json: vi.fn((body: unknown, status: number) => ({ body, status })),
    };
    const res = handler(new Error('x'), c);
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(res.body.error.message).toContain('unexpected error');
  });

  it('surfaces a generic message regardless of the thrown error text', () => {
    const logger = { error: vi.fn() } as any;
    const handler = createErrorHandler(logger);
    const c: any = {
      req: { path: '/a', method: 'POST' },
      json: vi.fn((body: unknown, status: number) => ({ body, status })),
    };
    const res = handler(new Error('secret DB creds leaked'), c);
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('secret DB creds leaked');
  });
});