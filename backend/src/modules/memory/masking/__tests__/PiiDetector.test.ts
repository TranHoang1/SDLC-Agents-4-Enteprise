import { describe, it, expect } from 'vitest';
import { PiiDetector } from '../detectors/PiiDetector.js';

describe('PiiDetector', () => {
  const detector = new PiiDetector();

  describe('email detection', () => {
    it('detects email in plain text', () => {
      const results = detector.detect('Contact us at user@example.com for info');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].type).toBe('email');
      expect(results[0].match).toBe('user@example.com');
    });

    it('detects multiple emails', () => {
      const results = detector.detect('Email admin@corp.io or support@corp.io');
      expect(results.length).toBe(2);
    });

    it('returns empty for clean text', () => {
      const results = detector.detect('Normal text without sensitive data');
      const emails = results.filter(r => r.type === 'email');
      expect(emails.length).toBe(0);
    });
  });

  describe('phone detection', () => {
    it('detects international phone', () => {
      const results = detector.detect('Call +1-234-567-8901');
      const phones = results.filter(r => r.type === 'phone');
      expect(phones.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('IP detection', () => {
    it('detects IP address', () => {
      const results = detector.detect('Server at 192.168.1.100');
      const ips = results.filter(r => r.type === 'ip');
      expect(ips.length).toBe(1);
      expect(ips[0].match).toBe('192.168.1.100');
    });
  });

  describe('credit card detection', () => {
    it('detects credit card with dashes', () => {
      const results = detector.detect('Card: 4111-1111-1111-1111');
      const ccs = results.filter(r => r.type === 'credit_card');
      expect(ccs.length).toBe(1);
    });
  });

  describe('SSN detection', () => {
    it('detects SSN', () => {
      const results = detector.detect('SSN: 123-45-6789');
      const ssns = results.filter(r => r.type === 'ssn');
      expect(ssns.length).toBeGreaterThanOrEqual(1);
    });
  });
});
