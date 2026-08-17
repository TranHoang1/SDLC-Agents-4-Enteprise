/**
 * SA4E-110 — End-to-end API tests (E2E-01 to E2E-09)
 * Tests full flows through client → API with mocked external Jira/Confluence.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { JiraApiClient } from '../clients/jira-client.js';
import { ConfluenceApiClient } from '../clients/confluence-client.js';
import { RateLimiter } from '../clients/rate-limiter.js';
import { AtlassianApiError } from '../clients/base-client.js';
import type { HttpClientConfig } from '../models/types.js';

function createE2EConfig(): HttpClientConfig {
  return {
    baseUrl: 'https://e2e.atlassian.net',
    authHeaders: async () => ({ Authorization: 'Basic ZTJlOnRva2Vu' }),
    rateLimiter: new RateLimiter(100, 60000),
    timeouts: { default: 10000, upload: 60000 },
  };
}

function stubFetch(responses: Array<{ status: number; body: unknown }>): void {
  let callIdx = 0;
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
    const resp = responses[callIdx] ?? responses[responses.length - 1];
    callIdx++;
    return Promise.resolve({
      ok: resp.status >= 200 && resp.status < 300,
      status: resp.status,
      headers: new Headers(),
      text: () => Promise.resolve(JSON.stringify(resp.body)),
    });
  }));
}

describe('E2E-01: Create issue → get issue → update → delete', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('completes full CRUD lifecycle', async () => {
    stubFetch([
      { status: 201, body: { id: '10001', key: 'TEST-1' } },
      { status: 200, body: { key: 'TEST-1', fields: { summary: 'New' } } },
      { status: 204, body: {} },
      { status: 204, body: {} },
    ]);
    const client = new JiraApiClient(createE2EConfig());

    const created = await client.createIssue({ fields: { summary: 'New', project: { key: 'TEST' }, issuetype: { name: 'Task' } } });
    expect(created.status).toBe(201);

    const fetched = await client.getIssue('TEST-1');
    expect(fetched.status).toBe(200);

    const updated = await client.updateIssue('TEST-1', { summary: 'Updated' });
    expect(updated.status).toBe(204);

    const deleted = await client.deleteIssue('TEST-1', false);
    expect(deleted.status).toBe(204);
  });
});

describe('E2E-02: Search with JQL → paginate results', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('fetches paginated search results', async () => {
    stubFetch([
      { status: 200, body: { issues: [{ key: 'P-1' }, { key: 'P-2' }], total: 10, startAt: 0 } },
      { status: 200, body: { issues: [{ key: 'P-3' }], total: 10, startAt: 2 } },
    ]);
    const client = new JiraApiClient(createE2EConfig());

    const page1 = await client.searchJql('project = P', undefined, undefined, 0, 2);
    expect((page1.data as any).issues).toHaveLength(2);

    const page2 = await client.searchJql('project = P', undefined, undefined, 2, 2);
    expect((page2.data as any).issues).toHaveLength(1);
  });
});

describe('E2E-03: Transition issue workflow', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('gets transitions then executes transition', async () => {
    stubFetch([
      { status: 200, body: { transitions: [{ id: '31', name: 'Done' }] } },
      { status: 204, body: {} },
    ]);
    const client = new JiraApiClient(createE2EConfig());

    const transitions = await client.getTransitions('PROJ-5');
    expect((transitions.data as any).transitions[0].name).toBe('Done');

    const result = await client.transitionIssue('PROJ-5', '31');
    expect(result.status).toBe(204);
  });
});

describe('E2E-04: Comment lifecycle', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('add → get → update → delete comment', async () => {
    stubFetch([
      { status: 201, body: { id: 'c-1', body: 'Hello' } },
      { status: 200, body: { id: 'c-1', body: 'Hello' } },
      { status: 200, body: { id: 'c-1', body: 'Updated' } },
      { status: 204, body: {} },
    ]);
    const client = new JiraApiClient(createE2EConfig());

    const added = await client.addComment('X-1', { body: 'Hello' });
    expect(added.status).toBe(201);

    const got = await client.getComment('X-1', 'c-1');
    expect(got.status).toBe(200);

    const updated = await client.updateComment('X-1', 'c-1', { body: 'Updated' });
    expect(updated.status).toBe(200);

    const deleted = await client.deleteComment('X-1', 'c-1');
    expect(deleted.status).toBe(204);
  });
});

describe('E2E-05: Confluence page CRUD', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('create → get → update → delete page', async () => {
    stubFetch([
      { status: 200, body: { id: 'p-1', title: 'New Page' } },
      { status: 200, body: { id: 'p-1', title: 'New Page' } },
      { status: 200, body: { id: 'p-1', title: 'Updated' } },
      { status: 204, body: {} },
    ]);
    const client = new ConfluenceApiClient(createE2EConfig());

    const created = await client.createPage({ title: 'New Page', body: '<p>content</p>' });
    expect(created.status).toBe(200);

    const got = await client.getPage('p-1');
    expect(got.status).toBe(200);

    const updated = await client.updatePage('p-1', { title: 'Updated' });
    expect(updated.status).toBe(200);

    const deleted = await client.deletePage('p-1');
    expect(deleted.status).toBe(204);
  });
});

describe('E2E-06: Auth failure triggers single refresh', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('retries once on 401, then throws if still failing', async () => {
    stubFetch([
      { status: 401, body: { message: 'Unauthorized' } },
      { status: 401, body: { message: 'Still unauthorized' } },
    ]);
    const client = new JiraApiClient(createE2EConfig());
    await expect(client.getIssue('X-1')).rejects.toThrow(AtlassianApiError);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe('E2E-07: Worklog add and delete', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('adds worklog then deletes it', async () => {
    stubFetch([
      { status: 201, body: { id: 'wl-1' } },
      { status: 204, body: {} },
    ]);
    const client = new JiraApiClient(createE2EConfig());
    const added = await client.addWorklog('X-1', { timeSpent: '2h' });
    expect(added.status).toBe(201);
    const deleted = await client.deleteWorklog('X-1', 'wl-1');
    expect(deleted.status).toBe(204);
  });
});

describe('E2E-08: Confluence search with CQL', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('searches content by text query', async () => {
    stubFetch([{ status: 200, body: { results: [{ id: 'r-1', title: 'Result' }] } }]);
    const client = new ConfluenceApiClient(createE2EConfig());
    const res = await client.searchContent('deployment guide', 'DEV');
    expect(res.status).toBe(200);
    expect((res.data as any).results).toHaveLength(1);
  });
});

describe('E2E-09: Agile board and sprint listing', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('fetches boards then sprints for a board', async () => {
    stubFetch([
      { status: 200, body: { values: [{ id: 1, name: 'Team Board' }] } },
      { status: 200, body: { values: [{ id: 10, name: 'Sprint 1' }] } },
    ]);
    const client = new JiraApiClient(createE2EConfig());
    const boards = await client.getBoards();
    expect(boards.status).toBe(200);
    const sprints = await client.getSprints(1);
    expect(sprints.status).toBe(200);
  });
});
