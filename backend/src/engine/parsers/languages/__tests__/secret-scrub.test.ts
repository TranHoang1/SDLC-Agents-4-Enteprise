/**
 * SA4E-223 F-03 — Secret value redaction before persisting bodies.
 * Verifies scrubSecretValues() replaces the content of secret elements with
 * [REDACTED] (case-insensitive, attribute-tolerant) while leaving other content
 * untouched. Complements the existing symbol-name denylist (isSecretElement).
 */

import { describe, it, expect } from 'vitest';
import { scrubSecretValues } from '../salesforce-meta/helpers.js';

describe('scrubSecretValues (F-03)', () => {
  it('redacts password element value', () => {
    const src = '<password>supersecret</password>';
    const out = scrubSecretValues(src);
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain('supersecret');
  });

  it('redacts loginUrl element value', () => {
    const src = '<loginUrl>https://evil.example/login</loginUrl>';
    const out = scrubSecretValues(src);
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain('evil.example');
  });

  it('is case-insensitive', () => {
    const src = '<PASSWORD>abc123</PASSWORD>';
    const out = scrubSecretValues(src);
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain('abc123');
  });

  it('tolerates attributes on the secret element', () => {
    const src = '<password type="oauth">hunter2</password>';
    const out = scrubSecretValues(src);
    expect(out).toContain('<password>');
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain('hunter2');
  });

  it('leaves non-secret content unchanged', () => {
    const src = '<fullName>MyLabel</fullName><dataType>Text</dataType>';
    expect(scrubSecretValues(src)).toBe(src);
  });

  it('redacts multiple secret elements in one source', () => {
    const src = '<password>a</password><secret>b</secret>';
    const out = scrubSecretValues(src);
    expect(out).not.toContain('>a<');
    expect(out).not.toContain('>b<');
    expect((out.match(/\[REDACTED\]/g) || []).length).toBe(2);
  });
});
