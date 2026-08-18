/**
 * Unit tests — security-headers middleware.
 * Verifies all security headers are applied, next is awaited first, and the
 * X-Powered-By header is stripped.
 */

import { describe, it, expect, vi } from 'vitest';
import { securityHeaders } from '../security-headers.js';

function makeContext() {
  const headers = new Map<string, string>();
  const header = vi.fn((name: string, value: string) => { headers.set(name, value); });
  const deletePoweredBy = vi.fn();
  const c: any = {
    header,
    res: { headers: { delete: deletePoweredBy } },
  };
  return { c, headers, header, deletePoweredBy };
}

describe('securityHeaders', () => {
  it('awaits next before applying headers', async () => {
    const order: string[] = [];
    const { c } = makeContext();
    await securityHeaders(c, vi.fn(async () => { order.push('next'); }));
    order.push('headers');
    expect(order).toEqual(['next', 'headers']);
  });

  it('sets X-Content-Type-Options nosniff', async () => {
    const { c, headers } = makeContext();
    await securityHeaders(c, vi.fn(async () => {}));
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('sets X-XSS-Protection, Referrer-Policy and Permissions-Policy', async () => {
    const { c, headers } = makeContext();
    await securityHeaders(c, vi.fn(async () => {}));
    expect(headers.get('X-XSS-Protection')).toBe('1; mode=block');
    expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(headers.get('Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=()');
  });

  it('sets a restrictive Content-Security-Policy', async () => {
    const { c, headers } = makeContext();
    await securityHeaders(c, vi.fn(async () => {}));
    const csp = headers.get('Content-Security-Policy')!;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("script-src 'self'");
  });

  it('removes the X-Powered-By header', async () => {
    const { c, deletePoweredBy } = makeContext();
    await securityHeaders(c, vi.fn(async () => {}));
    expect(deletePoweredBy).toHaveBeenCalledWith('X-Powered-By');
  });
});