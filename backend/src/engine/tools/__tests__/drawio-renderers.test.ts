/**
 * SA4E — Unit tests for drawio-renderers CLI cache, upstream server detection,
 * and sleep helper (pure portions; exportWithCli/Chrome/Puppeteer need external
 * binaries or MCP servers and are skipped here).
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  setCachedDrawioCliPath, getCachedDrawioCliPath, findDrawioCli,
  hasUpstreamServer, sleep,
} from '../drawio-renderers.js';

afterEach(() => setCachedDrawioCliPath(null));

describe('drawio CLI path cache', () => {
  it('round-trips the cached path', () => {
    expect(getCachedDrawioCliPath()).toBeNull();
    setCachedDrawioCliPath('C:\\fake\\draw.io.exe');
    expect(getCachedDrawioCliPath()).toBe('C:\\fake\\draw.io.exe');
  });

  it('findDrawioCli prefers the cached path without filesystem probing', () => {
    setCachedDrawioCliPath('C:\\fake\\draw.io.exe');
    expect(findDrawioCli()).toBe('C:\\fake\\draw.io.exe');
    expect(getCachedDrawioCliPath()).toBe('C:\\fake\\draw.io.exe');
  });

  it('clearing the cache allows re-search to find a real install', () => {
    setCachedDrawioCliPath('C:\\fake\\draw.io.exe');
    setCachedDrawioCliPath(null);
    expect(getCachedDrawioCliPath()).toBeNull();
    const found = findDrawioCli();
    // Machine-dependent: a real draw.io install may or may not exist.
    expect(found === null || found.length > 0).toBe(true);
  });
});

describe('hasUpstreamServer', () => {
  it('matches an active server by substring, case-insensitive', () => {
    const engine = { getStatus: () => ({ servers: [{ name: 'chrome-devtools-mcp', state: 'ACTIVE' }] }) };
    expect(hasUpstreamServer(engine, 'chrome-devtools')).toBe(true);
    expect(hasUpstreamServer(engine, 'CHROME-DEVTOOLS')).toBe(true);
  });

  it('returns false for servers not in ACTIVE state', () => {
    const engine = { getStatus: () => ({ servers: [{ name: 'puppeteer', state: 'CONNECTING' }] }) };
    expect(hasUpstreamServer(engine, 'puppeteer')).toBe(false);
  });

  it('returns false when getStatus is unavailable or has no servers', () => {
    expect(hasUpstreamServer({}, 'anything')).toBe(false);
    expect(hasUpstreamServer({ getStatus: () => ({}) }, 'anything')).toBe(false);
    expect(hasUpstreamServer({ getStatus: () => ({ servers: [] }) }, 'anything')).toBe(false);
  });

  it('matches against any server in the list', () => {
    const engine = {
      getStatus: () => ({
        servers: [
          { name: 'puppeteer', state: 'ACTIVE' },
          { name: 'chrome-devtools-mcp', state: 'INACTIVE' },
        ],
      }),
    };
    expect(hasUpstreamServer(engine, 'puppeteer')).toBe(true);
    expect(hasUpstreamServer(engine, 'chrome')).toBe(false);
  });
});

describe('sleep', () => {
  it('resolves after the given number of milliseconds', async () => {
    const started = Date.now();
    await sleep(5);
    expect(Date.now() - started).toBeGreaterThanOrEqual(4);
  });
});