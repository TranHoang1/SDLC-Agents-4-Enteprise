/**
 * SA4E-110 — Unit tests for config module (UT-06, UT-07)
 * Tests default configuration and override merging.
 */
import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG, createConfig } from '../config.js';

describe('UT-06: DEFAULT_CONFIG — correct default values', () => {
  it('has default timeout of 30000ms', () => {
    expect(DEFAULT_CONFIG.timeouts.default).toBe(30000);
  });

  it('has upload timeout of 120000ms', () => {
    expect(DEFAULT_CONFIG.timeouts.upload).toBe(120000);
  });

  it('has rate limiter with 100 tokens', () => {
    expect(DEFAULT_CONFIG.rateLimiter.maxTokens).toBe(100);
  });

  it('has rate limiter refill interval of 60000ms', () => {
    expect(DEFAULT_CONFIG.rateLimiter.refillIntervalMs).toBe(60000);
  });

  it('has health check interval of 30000ms', () => {
    expect(DEFAULT_CONFIG.healthCheck.intervalMs).toBe(30000);
  });

  it('has health check timeout of 5000ms', () => {
    expect(DEFAULT_CONFIG.healthCheck.timeoutMs).toBe(5000);
  });
});

describe('UT-07: createConfig — merges overrides with defaults', () => {
  it('returns defaults when no overrides provided', () => {
    const config = createConfig();
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it('merges partial timeout overrides', () => {
    const config = createConfig({ timeouts: { default: 5000, upload: 60000 } });
    expect(config.timeouts.default).toBe(5000);
    expect(config.timeouts.upload).toBe(60000);
    expect(config.rateLimiter).toEqual(DEFAULT_CONFIG.rateLimiter);
  });

  it('merges partial rate limiter overrides', () => {
    const config = createConfig({ rateLimiter: { maxTokens: 50, refillIntervalMs: 30000 } });
    expect(config.rateLimiter.maxTokens).toBe(50);
    expect(config.timeouts).toEqual(DEFAULT_CONFIG.timeouts);
  });

  it('preserves server metadata when not overridden', () => {
    const config = createConfig({ timeouts: { default: 1000, upload: 2000 } });
    expect(config.server.name).toBe('atlassian-mcp-server');
    expect(config.server.version).toBe('1.0.0');
  });
});
