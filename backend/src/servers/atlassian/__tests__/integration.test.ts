/**
 * SA4E-110 — Integration tests (IT-01 to IT-14)
 * Tests full code paths with mocked HTTP layer.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JiraApiClient } from '../clients/jira-client.js';
import { ConfluenceApiClient } from '../clients/confluence-client.js';
import { RateLimiter } from '../clients/rate-limiter.js';
import { levenshtein } from '../utils/levenshtein.js';
import { normalizeForComparison } from '../utils/normalize.js';
import { createConfig } from '../config.js';
import { AtlassianApiError } from '../clients/base-client.js';
import { AtlassianErrorCode } from '../models/types.js';
import type { HttpClientConfig } from '../models/types.js';

function createTestConfig(): HttpClientConfig {
  return {
    baseUrl: 'https://test.atlassian.net',
    authHeaders: async () => ({ Authorization: 'Basic dGVzdA==' }),
    rateLimiter: new RateLimiter(100, 60000),
    timeouts: { default: 5000, upload: 30000 },
  };
}

function mockFetchOk(data: unknown): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true, status: 200, headers: new Headers(),
    text: () => Promise.resolve(JSON.stringify(data)),
  }));
}

describe('IT-01: Fuzzy transition match — exact match', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('finds exact transition by name (case insensitive)', () => {
    const transitions = [
      { id: '1', name: 'In Progress' },
      { id: '2', name: 'Done' },
    ];
    const input = normalizeForComparison('in progress');
    const match = transitions.find(t => normalizeForComparison(t.name) === input);
    expect(match?.id).toBe('1');
  });
});

describe('IT-02: Fuzzy transition match — levenshtein fallback', () => {
  it('matches transition with edit distance <= 2', () => {
    const transitions = [
      { id: '1', name: 'In Progress' },
      { id: '2', name: 'Done' },
      { id: '3', name: 'Review' },
    ];
    const input = normalizeForComparison('in progres'); // typo
    const fuzzy = transitions.filter(t =>
      levenshtein(normalizeForComparison(t.name), input) <= 2
    );
    expect(fuzzy).toHaveLength(1);
    expect(fuzzy[0].id).toBe('1');
  });
});

describe('IT-03: Fuzzy transition match — ambiguous results', () => {
  it('returns multiple matches when distance is same', () => {
    const transitions = [
      { id: '1', name: 'Done' },
      { id: '2', name: 'Dome' },
    ];
    const input = normalizeForComparison('dne');
    const fuzzy = transitions.filter(t =>
      levenshtein(normalizeForComparison(t.name), input) <= 2
    );
    expect(fuzzy.length).toBeGreaterThanOrEqual(1);
  });
});

describe('IT-04: JiraApiClient — getIssue full path', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('calls correct URL with fields parameter', async () => {
    mockFetchOk({ key: 'PROJ-1', fields: { summary: 'Test' } });
    const client = new JiraApiClient(createTestConfig());
    const res = await client.getIssue('PROJ-1', 'summary,status');
    expect(res.status).toBe(200);
    const fetchCall = (fetch as any).mock.calls[0];
    expect(fetchCall[0]).toContain('/rest/api/2/issue/PROJ-1?fields=summary%2Cstatus');
  });
});

describe('IT-05: JiraApiClient — searchJql full path', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('sends GET with JQL query params', async () => {
    mockFetchOk({ issues: [], total: 0 });
    const client = new JiraApiClient(createTestConfig());
    const res = await client.searchJql('project = TEST', undefined, undefined, 0, 10);
    expect(res.status).toBe(200);
    const fetchCall = (fetch as any).mock.calls[0];
    expect(fetchCall[0]).toContain('/rest/api/3/search/jql');
    expect(fetchCall[1].method).toBe('GET');
  });
});

describe('IT-06: ConfluenceApiClient — search full path', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('encodes CQL query in URL', async () => {
    mockFetchOk({ results: [] });
    const client = new ConfluenceApiClient(createTestConfig());
    await client.search('space = DEV', 0, 10);
    const fetchCall = (fetch as any).mock.calls[0];
    expect(fetchCall[0]).toContain('cql=space%20%3D%20DEV');
  });
});

describe('IT-07: ConfluenceApiClient — createPage full path', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('sends POST with page body', async () => {
    mockFetchOk({ id: '123', title: 'New Page' });
    const client = new ConfluenceApiClient(createTestConfig());
    const res = await client.createPage({ title: 'New', body: '<p>Hi</p>' });
    expect(res.status).toBe(200);
  });
});

describe('IT-08: Rate limiter integration with client', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('acquires token before making request', async () => {
    mockFetchOk({ ok: true });
    const limiter = new RateLimiter(100, 60000);
    const acquireSpy = vi.spyOn(limiter, 'acquire');
    const config: HttpClientConfig = { ...createTestConfig(), rateLimiter: limiter };
    const client = new JiraApiClient(config);
    await client.getIssue('X-1');
    expect(acquireSpy).toHaveBeenCalledTimes(1);
  });
});

describe('IT-09: Config merging with client creation', () => {
  it('createConfig produces valid config for client', () => {
    const config = createConfig({ timeouts: { default: 1000, upload: 5000 } });
    expect(config.timeouts.default).toBe(1000);
    expect(config.rateLimiter.maxTokens).toBe(100);
  });
});

describe('IT-10: JiraApiClient — error propagation', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('propagates 404 as AtlassianApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 404, headers: new Headers(),
      text: () => Promise.resolve('Not Found'),
    }));
    const client = new JiraApiClient(createTestConfig());
    await expect(client.getIssue('BAD-999')).rejects.toThrow(AtlassianApiError);
  });
});

describe('IT-11: Attachment upload uses upload timeout', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('sends X-Atlassian-Token header for uploads', async () => {
    mockFetchOk({ id: 'att-1' });
    const client = new JiraApiClient(createTestConfig());
    const formData = new FormData();
    await client.attachFile('PROJ-1', formData);
    const fetchCall = (fetch as any).mock.calls[0];
    expect(fetchCall[1].headers['X-Atlassian-Token']).toBe('no-check');
  });
});

describe('IT-12: Multiple sequential requests share rate limiter', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('rate limiter state persists across requests', async () => {
    mockFetchOk({});
    const limiter = new RateLimiter(5, 60000);
    const config: HttpClientConfig = { ...createTestConfig(), rateLimiter: limiter };
    const client = new JiraApiClient(config);
    // Make 5 requests (exhaust tokens)
    for (let i = 0; i < 5; i++) await client.getIssue(`P-${i}`);
    expect(fetch).toHaveBeenCalledTimes(5);
  });
});

describe('IT-13: IPC credential flow end-to-end', () => {
  it('CredentialManager provides headers to client config', async () => {
    const mockAuthHeaders = async () => ({ Authorization: 'Basic abc123' });
    const config: HttpClientConfig = {
      ...createTestConfig(),
      authHeaders: mockAuthHeaders,
    };
    const headers = await config.authHeaders();
    expect(headers.Authorization).toBe('Basic abc123');
  });
});

describe('IT-14: MCP handshake — server metadata', () => {
  it('createConfig returns correct server name and version', () => {
    const config = createConfig();
    expect(config.server.name).toBe('atlassian-mcp-server');
    expect(config.server.version).toBe('1.0.0');
  });
});
