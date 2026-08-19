/**
 * SA4E-182 — secretFilter unit tests.
 * Tests: API key redaction, PEM key redaction, env var redaction, passthrough.
 */

import { describe, it, expect } from 'vitest';
import { filterSecrets, containsSecrets } from '../secretFilter';

describe('filterSecrets', () => {
  it('should redact API keys (sk- pattern)', () => {
    const input = 'My key is sk-abcdefghijklmnopqrstuvwxyz123456';
    const result = filterSecrets(input);
    expect(result).not.toContain('sk-abcdefghijklmnopqrstuvwxyz123456');
    expect(result).toContain('[REDACTED]');
  });

  it('should redact PEM private keys', () => {
    const input = '-----BEGIN RSA PRIVATE KEY-----\nMIIBog...\n-----END RSA PRIVATE KEY-----';
    const result = filterSecrets(input);
    expect(result).not.toContain('BEGIN RSA PRIVATE KEY');
    expect(result).toContain('[REDACTED]');
  });

  it('should redact environment variable exports with sensitive names', () => {
    const input = 'export API_KEY=supersecretvalue123';
    const result = filterSecrets(input);
    expect(result).toContain('[REDACTED]');
  });

  it('should redact GitHub tokens', () => {
    const input = 'Token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij';
    const result = filterSecrets(input);
    expect(result).toContain('[REDACTED]');
  });

  it('should redact connection strings with passwords', () => {
    const input = 'postgres://admin:p@ssw0rd@localhost:5432/db';
    const result = filterSecrets(input);
    expect(result).toContain('[REDACTED]');
  });

  it('should not redact normal text', () => {
    const input = 'Hello world, this is normal conversation about code.';
    const result = filterSecrets(input);
    expect(result).toBe(input);
  });

  it('should not redact short strings that look like variable references', () => {
    const input = 'The key variable stores the lookup index.';
    const result = filterSecrets(input);
    expect(result).toBe(input);
  });
});

describe('containsSecrets', () => {
  it('should detect API keys', () => {
    expect(containsSecrets('key is sk-abcdefghijklmnopqrstuvwxyz1234')).toBe(true);
  });

  it('should return false for clean text', () => {
    expect(containsSecrets('Just a normal message')).toBe(false);
  });
});
