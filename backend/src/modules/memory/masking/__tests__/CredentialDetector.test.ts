import { describe, it, expect } from 'vitest';
import { CredentialDetector } from '../detectors/CredentialDetector.js';

describe('CredentialDetector', () => {
  const detector = new CredentialDetector();

  it('detects sk- API key', () => {
    const r = detector.detect('key: sk-abc123xyz789abcdefghijklm');
    expect(r.length).toBeGreaterThanOrEqual(1);
    expect(r[0].type).toBe('api_key');
  });

  it('detects ghp_ GitHub PAT', () => {
    const r = detector.detect('ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
    expect(r.length).toBeGreaterThanOrEqual(1);
    expect(r[0].type).toBe('api_key');
  });

  it('detects JWT token', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N';
    const r = detector.detect(jwt);
    const jwts = r.filter(d => d.type === 'jwt');
    expect(jwts.length).toBe(1);
  });

  it('detects password in config', () => {
    const r = detector.detect('password=MyS3cr3tP@ss');
    const pwds = r.filter(d => d.type === 'password');
    expect(pwds.length).toBe(1);
  });

  it('detects connection string', () => {
    const r = detector.detect('postgres://admin:secret@db.host:5432/mydb');
    const conns = r.filter(d => d.type === 'connection_string');
    expect(conns.length).toBe(1);
  });

  it('detects private key header', () => {
    const r = detector.detect('-----BEGIN RSA PRIVATE KEY-----');
    const keys = r.filter(d => d.type === 'private_key');
    expect(keys.length).toBe(1);
  });

  it('returns empty for clean text', () => {
    const r = detector.detect('Normal text without credentials');
    expect(r.length).toBe(0);
  });
});
