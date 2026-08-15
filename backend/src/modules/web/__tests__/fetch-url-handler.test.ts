/**
 * WebModule — Unit tests for FetchUrlHandler.
 * Uses a mocked global fetch and a fake SsrfGuard to exercise handler logic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FetchUrlHandler } from '../handlers/FetchUrlHandler.js';
import { SsrfGuard } from '../middleware/SsrfGuard.js';
import { RateLimiter } from '../middleware/RateLimiter.js';
import { ContentTruncator } from '../middleware/ContentTruncator.js';
import { WebToolError } from '../models/WebError.js';
import type { WebModuleConfig } from '../models/WebModuleConfig.js';

const config: WebModuleConfig = {
  searxngUrl: 'http://localhost:8080',
  rateLimitRpm: 100,
  timeoutMs: 5000,
  maxResponseKb: 100,
  maxDownloadMb: 50,
  maxBrowserContexts: 3,
  blockedExtensions: [],
  ssrfBlocklist: [],
  userAgent: 'test-agent',
  workspace: '/tmp',
};

function mockResponse(body: string, status = 200, contentType = 'text/html'): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    url: 'https://example.com/',
    headers: new Headers({ 'content-type': contentType }),
    text: () => Promise.resolve(body),
  } as unknown as Response;
}

describe('FetchUrlHandler', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function makeHandler(ssrfGuard?: SsrfGuard) {
    return new FetchUrlHandler(
      ssrfGuard ?? new SsrfGuard([]),
      new RateLimiter(config.rateLimitRpm),
      new ContentTruncator(config.maxResponseKb),
      config,
    );
  }

  it('fetches and returns extracted text content', async () => {
    fetchMock.mockResolvedValue(mockResponse('<html><head><title>My Page</title></head><body><p>Hello world</p></body></html>'));
    const handler = makeHandler();
    const result = await handler.handle({ url: 'https://example.com/page' });

    expect(result.isError).toBe(false);
    const data = JSON.parse((result.content[0] as { text: string }).text);
    expect(data.content).toContain('Hello world');
    expect(data.metadata.title).toBe('My Page');
    expect(data.metadata.status_code).toBe(200);
    expect(data.metadata.cached).toBe(false);
    expect(data.metadata.url).toBe('https://example.com/');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns truncated mode content with max_length', async () => {
    fetchMock.mockResolvedValue(mockResponse('<p>' + 'x'.repeat(60000) + '</p>'));
    const handler = makeHandler();
    const result = await handler.handle({ url: 'https://example.com/big', mode: 'truncated', max_length: 100 });

    const data = JSON.parse((result.content[0] as { text: string }).text);
    expect(data.content.length).toBe(100);
  });

  it('returns selective mode content by selector', async () => {
    fetchMock.mockResolvedValue(mockResponse('<div><div class="target">Picked</div>skipped</div>'));
    const handler = makeHandler();
    const result = await handler.handle({ url: 'https://example.com/sel', mode: 'selective', selector: '.target' });

    const data = JSON.parse((result.content[0] as { text: string }).text);
    expect(data.content).toBe('Picked');
  });

  it('caches identical requests and bypasses cache with no_cache', async () => {
    fetchMock.mockResolvedValue(mockResponse('<p>cached body</p>'));
    const handler = makeHandler();
    await handler.handle({ url: 'https://example.com/cache' });
    await handler.handle({ url: 'https://example.com/cache' });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await handler.handle({ url: 'https://example.com/cache', no_cache: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uses different cache entries per mode', async () => {
    fetchMock.mockResolvedValue(mockResponse('<p>content</p>'));
    const handler = makeHandler();
    await handler.handle({ url: 'https://example.com/m' });
    await handler.handle({ url: 'https://example.com/m', mode: 'truncated' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns INVALID_URL error for bad URLs before calling fetch', async () => {
    fetchMock.mockResolvedValue(mockResponse('<p>x</p>'));
    const handler = makeHandler();
    const result = await handler.handle({ url: 'not-a-url', no_cache: true });
    expect(result.isError).toBe(true);
    const data = JSON.parse((result.content[0] as { text: string }).text);
    expect(data.error).toBe('INVALID_URL');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns SSRF_BLOCKED error when the SSRF guard rejects', async () => {
    const blockingGuard = new SsrfGuard([]);
    vi.spyOn(blockingGuard, 'validate').mockRejectedValue(new WebToolError('SSRF_BLOCKED', 'Blocked internal IP', { ip: '127.0.0.1' }));
    const handler = makeHandler(blockingGuard);
    const result = await handler.handle({ url: 'https://example.com/private' });
    expect(result.isError).toBe(true);
    const data = JSON.parse((result.content[0] as { text: string }).text);
    expect(data.error).toBe('SSRF_BLOCKED');
  });

  it('returns TIMEOUT error when the fetch aborts', async () => {
    fetchMock.mockRejectedValue({ name: 'AbortError', message: 'aborted' });
    const handler = makeHandler();
    const result = await handler.handle({ url: 'https://example.com/slow' });
    expect(result.isError).toBe(true);
    const data = JSON.parse((result.content[0] as { text: string }).text);
    expect(data.error).toBe('TIMEOUT');
  });

  it('passes the configured user-agent header', async () => {
    fetchMock.mockResolvedValue(mockResponse('<p>ua</p>'));
    const handler = makeHandler();
    await handler.handle({ url: 'https://example.com/ua' });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ 'User-Agent': 'test-agent' });
  });
});