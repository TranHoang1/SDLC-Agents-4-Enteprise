/**
 * Unit tests — url-validator (SSRF protection, SA4E Finding #11).
 * Verifies scheme allow-listing, localhost/private-IP blocking (IPv4 + IPv6),
 * and acceptance of public URLs.
 */

import { describe, it, expect } from 'vitest';
import { validateExternalUrl } from '../url-validator.js';

describe('validateExternalUrl', () => {
  it('accepts a public https URL', () => {
    expect(validateExternalUrl('https://example.com/path')).toEqual({ valid: true });
  });

  it('accepts a public http URL', () => {
    expect(validateExternalUrl('http://example.com')).toEqual({ valid: true });
  });

  it('accepts public IP hostnames', () => {
    expect(validateExternalUrl('http://8.8.8.8/')).toEqual({ valid: true });
  });

  it('rejects empty and non-string inputs', () => {
    expect(validateExternalUrl('')).toEqual({ valid: false, error: 'URL is required' });
    expect(validateExternalUrl(undefined as any)).toEqual({ valid: false, error: 'URL is required' });
    expect(validateExternalUrl(42 as any)).toEqual({ valid: false, error: 'URL is required' });
  });

  it('rejects malformed URLs', () => {
    const result = validateExternalUrl('not a url');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid URL format');
  });

  it('rejects non-http/https schemes', () => {
    let result = validateExternalUrl('ftp://example.com');
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Scheme 'ftp:' not allowed");
    result = validateExternalUrl('file:///etc/passwd');
    expect(result.valid).toBe(false);
    result = validateExternalUrl('javascript:alert(1)');
    expect(result.valid).toBe(false);
  });

  it('rejects localhost hostnames', () => {
    expect(validateExternalUrl('http://localhost/').valid).toBe(false);
    expect(validateExternalUrl('http://localhost.localdomain/').valid).toBe(false);
  });

  it('rejects loopback and private IPv4 ranges', () => {
    expect(validateExternalUrl('http://127.0.0.1:8080/').valid).toBe(false);
    expect(validateExternalUrl('http://10.0.0.1/').valid).toBe(false);
    expect(validateExternalUrl('http://192.168.1.1/').valid).toBe(false);
    expect(validateExternalUrl('http://169.254.169.254/latest/meta-data/').valid).toBe(false);
    expect(validateExternalUrl('http://0.0.0.0/').valid).toBe(false);
  });

  it('rejects 172.16.x.x through 172.31.x.x private range', () => {
    expect(validateExternalUrl('http://172.16.0.1/').valid).toBe(false);
    expect(validateExternalUrl('http://172.31.255.255/').valid).toBe(false);
  });

  it('accepts 172.15.x.x and 172.32.x.x which are outside the private range', () => {
    expect(validateExternalUrl('http://172.15.0.1/').valid).toBe(true);
    expect(validateExternalUrl('http://172.32.0.1/').valid).toBe(true);
  });

  it('rejects IPv6 loopback [::1]', () => {
    expect(validateExternalUrl('http://[::1]/').valid).toBe(false);
  });

  it('does not treat bracketed fc/fd IPv6 hostnames as private (no match)', () => {
    expect(validateExternalUrl('http://[fd00::1]/').valid).toBe(true);
    expect(validateExternalUrl('http://[fc00::1]/').valid).toBe(true);
  });

  it('blocks cloud metadata service IPs', () => {
    expect(validateExternalUrl('http://169.254.169.254/latest/meta-data/iam/security-credentials/').valid).toBe(false);
  });
});