/**
 * SA4E-102 (D-1 / D-2) — Fire-and-forget KB auto-cache client for the Atlassian MCP server.
 *
 * The Atlassian server runs as a standalone STDIO MCP process, SEPARATE from the
 * main REST backend that hosts `/api/v1/memory/ingest` and the `/mcp` graph tools.
 * To satisfy BRD #2 (UC-02) on-demand auto-cache, this client mirrors the
 * extension's KBClient.ingest payload shape and POSTs to the same backend ingest
 * endpoint, plus creates a TICKET graph node (BRD #4 / UC-04).
 *
 * Every call is fire-and-forget / best-effort. Callers MUST `void` the returned
 * promise (see `autoCacheTicket`) so the tool response is never blocked (<500ms).
 */
import pino from 'pino';

const logger = pino({ name: 'jira-kb-cache-client' });

/** Loosely-typed view of a Jira issue as returned by the Jira REST API. */
export interface JiraIssueLike {
  key: string;
  fields?: {
    summary?: string;
    status?: { name?: string } | null;
    priority?: { name?: string } | null;
    assignee?: { displayName?: string } | null;
    project?: { key?: string };
    issuetype?: { name?: string };
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

/** Resolve the backend base URL. Override via KB_BASE_URL; default to local dev port. */
function resolveBaseUrl(): string {
  if (process.env.KB_BASE_URL) return process.env.KB_BASE_URL.replace(/\/$/, '');
  const port = process.env.CODE_INTEL_PORT || '48721';
  return `http://127.0.0.1:${port}`;
}

/** Optional bearer token (KB_API_TOKEN) when the backend requires auth. */
function resolveToken(): string | undefined {
  return process.env.KB_API_TOKEN || undefined;
}

/** Project key is best derived from issue fields; fall back to issue-key prefix. */
export function deriveProjectKey(issue: JiraIssueLike): string {
  const fromFields = issue.fields?.project?.key;
  if (fromFields) return fromFields;
  const parts = (issue.key || '').split('-');
  return parts.length > 1 ? parts[0] : '';
}

/** Build the ingest payload (mirrors KBClient.ingest shape). */
export function buildMetadataIngestPayload(issue: JiraIssueLike) {
  const projectKey = deriveProjectKey(issue);
  const f = issue.fields ?? {};
  const key = issue.key;
  const summary = f.summary ?? key;
  const status = f.status?.name ?? 'Unknown';
  const priority = f.priority?.name ?? 'Medium';
  const assignee = f.assignee?.displayName ?? null;
  const issuetype = f.issuetype?.name ?? 'Unknown';
  const content = [
    `JIRA_ISSUE | key=${key} | type=${issuetype} | status=${status} | priority=${priority}`,
    `project=${projectKey} | assignee=${assignee ?? 'unassigned'}`,
    '',
    '## Summary',
    summary,
  ].join('\n');
  return {
    content,
    summary: `${key}: ${summary}`,
    type: 'CONTEXT',
    scope: 'PROJECT',
    source: `jira/${projectKey}/${key}/metadata`,
    tags: `jira,${projectKey},${issuetype},${status}`,
  };
}

/** Build the TICKET graph-node payload (kb_graph_add_node). */
export function buildTicketGraphNodePayload(issue: JiraIssueLike) {
  const projectKey = deriveProjectKey(issue);
  const f = issue.fields ?? {};
  const key = issue.key;
  const summary = f.summary ?? key;
  return {
    entry_id: `jira/${projectKey}/${key}`,
    label: `${key}: ${summary}`,
    type: 'TICKET',
    tier: 'PROJECT',
    project_id: projectKey,
  };
}

/** POST to /api/v1/memory/ingest. Fire-and-forget (errors swallowed by caller). */
export async function ingestTicketMetadata(issue: JiraIssueLike): Promise<void> {
  const base = resolveBaseUrl();
  const token = resolveToken();
  const payload = buildMetadataIngestPayload(issue);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const res = await fetch(`${base}/api/v1/memory/ingest`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      logger.debug({ status: res.status, source: payload.source }, '[kb-cache] ingest non-fatal failure');
    }
  } catch (err) {
    logger.debug({ err: (err as Error).message, key: issue.key }, '[kb-cache] ingest skipped (backend unreachable)');
  }
}

/** POST JSON-RPC to /mcp calling kb_graph_add_node. Fire-and-forget. */
export async function addTicketGraphNode(issue: JiraIssueLike): Promise<void> {
  const base = resolveBaseUrl();
  const token = resolveToken();
  const args = buildTicketGraphNodePayload(issue);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const res = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: { name: 'kb_graph_add_node', arguments: args },
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      logger.debug({ status: res.status, entry_id: args.entry_id }, '[kb-cache] graph node non-fatal failure');
    }
  } catch (err) {
    logger.debug({ err: (err as Error).message, key: issue.key }, '[kb-cache] graph node skipped (backend unreachable)');
  }
}

/**
 * Convenience: fire-and-forget both ingest + graph node for a fetched ticket.
 * Never throws — safe to call as `void autoCacheTicket(issue)` inside a tool handler.
 */
export function autoCacheTicket(issue: JiraIssueLike): void {
  void Promise.allSettled([ingestTicketMetadata(issue), addTicketGraphNode(issue)]).catch(() => {});
}
