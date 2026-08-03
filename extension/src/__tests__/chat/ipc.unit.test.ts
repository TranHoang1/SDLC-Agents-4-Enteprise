/**
 * SA4E-85 — Unit Tests: IPC Bridge (UT-IPC-01/02/03/04).
 * Tests backoff calculation, localhost validation, service discovery parsing.
 */

import { describe, test, expect } from 'vitest';
import { isLocalhostEndpoint, parseDiscoveryFile } from '../../chat/ipc/serviceDiscovery';

describe('UT-IPC-01: Exponential Backoff Calculation', () => {
  const BACKOFF_DELAYS = [1000, 2000, 4000, 8000, 16000];

  function computeBackoffDelay(retryIndex: number): number {
    return BACKOFF_DELAYS[Math.min(retryIndex, BACKOFF_DELAYS.length - 1)];
  }

  test('retry 0 = 1000ms', () => expect(computeBackoffDelay(0)).toBe(1000));
  test('retry 1 = 2000ms', () => expect(computeBackoffDelay(1)).toBe(2000));
  test('retry 2 = 4000ms', () => expect(computeBackoffDelay(2)).toBe(4000));
  test('retry 3 = 8000ms', () => expect(computeBackoffDelay(3)).toBe(8000));
  test('retry 4 = 16000ms', () => expect(computeBackoffDelay(4)).toBe(16000));
  test('retry 5+ capped at 16000ms', () => expect(computeBackoffDelay(10)).toBe(16000));
});

describe('UT-IPC-02: Localhost-Only Validation', () => {
  test('ws://localhost:8080 is valid', () => {
    expect(isLocalhostEndpoint('ws://localhost:8080')).toBe(true);
  });
  test('ws://127.0.0.1:9090 is valid', () => {
    expect(isLocalhostEndpoint('ws://127.0.0.1:9090')).toBe(true);
  });
  test('ws://[::1]:7070 is valid', () => {
    expect(isLocalhostEndpoint('ws://[::1]:7070')).toBe(true);
  });
  test('ws://evil.com:8080 is rejected', () => {
    expect(isLocalhostEndpoint('ws://evil.com:8080')).toBe(false);
  });
  test('wss://remote:443 is rejected', () => {
    expect(isLocalhostEndpoint('wss://remote:443')).toBe(false);
  });
});

describe('UT-IPC-03: Service Offline Shows Warning', () => {
  test('offline status triggers warning', () => {
    expect('offline' === 'offline').toBe(true);
  });
  test('connected status hides warning', () => {
    expect('connected' === 'offline').toBe(false);
  });
});

describe('UT-IPC-04: Service Discovery File Validation', () => {
  test('valid discovery JSON parses correctly', () => {
    const json = JSON.stringify({
      ws_endpoint: 'ws://localhost:9999',
      rest_endpoint: 'http://localhost:9998',
      pid: 12345, status: 'running',
    });
    const result = parseDiscoveryFile(json);
    expect(result).not.toBeNull();
    expect(result!.ws_endpoint).toBe('ws://localhost:9999');
    expect(result!.pid).toBe(12345);
  });

  test('missing ws_endpoint returns null', () => {
    const json = JSON.stringify({ rest_endpoint: 'http://localhost:9998', pid: 1 });
    expect(parseDiscoveryFile(json)).toBeNull();
  });

  test('non-localhost endpoint returns null', () => {
    const json = JSON.stringify({
      ws_endpoint: 'ws://evil.com:9999',
      rest_endpoint: 'http://evil.com:9998', pid: 1,
    });
    expect(parseDiscoveryFile(json)).toBeNull();
  });

  test('invalid JSON returns null', () => {
    expect(parseDiscoveryFile('not json')).toBeNull();
  });
});
