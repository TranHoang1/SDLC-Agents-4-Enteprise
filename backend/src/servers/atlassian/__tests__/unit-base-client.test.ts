/**
 * SA4E-110 — Unit tests for BaseAtlassianClient (UT-11, UT-12, UT-16, UT-17, UT-22)
 * Retry logic, timeout handling, auth refresh, and error classification.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseAtlassianClient, AtlassianApiError } from '../clients/base-client.js';
import { AtlassianErrorCode } from '../models/types.js';
import type { HttpClientConfig, HttpResponse, RequestOptions } from '../models/types.js';

/** Concrete test subclass to access protected request method */
class TestClient extends BaseAtlassianClient {
  async doRequest<T>(options: RequestOptions): Promise<HttpResponse<T>> {
    return this.request<T>(options);
  }
}

function createMockConfig(overrides?: Partial<HttpClientConfig>): HttpClientConfig {
  return {
    baseUrl: 'https://test.atlassian.net',
    authHeaders: async () => ({ Authorization: 'Basic dGVzdDp0b2tlbg==' }),
    rateLimiter: { acquire: vi.fn().mockResolvedValue(undefined), setReconnectMode: vi.fn() },
    timeouts: { default: 5000, upload: 30000 },
    ...overrides,
  };
}

describe('UT-11: BaseAtlassianClient — retry on 429/5xx', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('retries on 429 and succeeds on next attempt', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(createMockResponse(429, ''))
      .mockResolvedValueOnce(createMockResponse(200, '{"ok":true}'));
    vi.stubGlobal('fetch', mockFetch);

    const client = new TestClient(createMockConfig());
    const result = await client.doRequest({ method: 'GET', path: '/test' });

    expect(result.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('retries on 500 up to MAX_RETRIES then throws', async () => {
    const mockFetch = vi.fn().mockResolvedValue(createMockResponse(500, 'Server Error'));
    vi.stubGlobal('fetch', mockFetch);

    const client = new TestClient(createMockConfig());
    await expect(client.doRequest({ method: 'GET', path: '/test' }))
      .rejects.toThrow(AtlassianApiError);
    // Initial + 3 retries = 4 total calls
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });
});

describe('UT-12: BaseAtlassianClient — timeout handling', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('throws TIMEOUT error when request is aborted', async () => {
    // Mock fetch to reject with AbortError (simulates timeout abort)
    const abortError = Object.assign(new Error('Aborted'), { name: 'AbortError' });
    const mockFetch = vi.fn().mockRejectedValue(abortError);
    vi.stubGlobal('fetch', mockFetch);

    const config = createMockConfig({ timeouts: { default: 50, upload: 100 } });
    const client = new TestClient(config);

    try {
      await client.doRequest({ method: 'GET', path: '/test' });
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AtlassianApiError);
      expect((e as AtlassianApiError).code).toBe(AtlassianErrorCode.TIMEOUT);
    }
    // Initial + MAX_RETRIES (3) = 4 total attempts
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });
});

describe('UT-16: BaseAtlassianClient — auth refresh on 401', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('retries once on 401 then fails if still 401', async () => {
    const mockFetch = vi.fn().mockResolvedValue(createMockResponse(401, 'Unauthorized'));
    vi.stubGlobal('fetch', mockFetch);

    const client = new TestClient(createMockConfig());
    await expect(client.doRequest({ method: 'GET', path: '/test' }))
      .rejects.toThrow(AtlassianApiError);
    // First call + auth refresh retry = 2 calls
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe('UT-17: BaseAtlassianClient — non-retryable errors', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('throws immediately on 400 without retry', async () => {
    const mockFetch = vi.fn().mockResolvedValue(createMockResponse(400, 'Bad Request'));
    vi.stubGlobal('fetch', mockFetch);

    const client = new TestClient(createMockConfig());
    await expect(client.doRequest({ method: 'GET', path: '/test' }))
      .rejects.toThrow(AtlassianApiError);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('throws immediately on 403 without retry', async () => {
    const mockFetch = vi.fn().mockResolvedValue(createMockResponse(403, 'Forbidden'));
    vi.stubGlobal('fetch', mockFetch);

    const client = new TestClient(createMockConfig());
    await expect(client.doRequest({ method: 'GET', path: '/test' }))
      .rejects.toThrow(AtlassianApiError);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('throws immediately on 404 without retry', async () => {
    const mockFetch = vi.fn().mockResolvedValue(createMockResponse(404, 'Not Found'));
    vi.stubGlobal('fetch', mockFetch);

    const client = new TestClient(createMockConfig());
    await expect(client.doRequest({ method: 'GET', path: '/test' }))
      .rejects.toThrow(AtlassianApiError);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe('UT-22: AtlassianApiError — error classification', () => {
  it('carries code and status properties', () => {
    const err = new AtlassianApiError(AtlassianErrorCode.NOT_FOUND, 'Not found', 404);
    expect(err.code).toBe(AtlassianErrorCode.NOT_FOUND);
    expect(err.status).toBe(404);
    expect(err.message).toBe('Not found');
    expect(err.name).toBe('AtlassianApiError');
  });
});

/** Helper: create a mock Response object */
function createMockResponse(status: number, body: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    text: () => Promise.resolve(body),
  } as unknown as Response;
}
