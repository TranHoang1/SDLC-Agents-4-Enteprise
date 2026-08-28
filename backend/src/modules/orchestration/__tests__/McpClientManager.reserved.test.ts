/**
 * SA4E-218 — Reserved tool names must never be shadowed by a child MCP server.
 *
 * Regression test: an external Atlassian child server registering `jira_create_issue`
 * with an incompatible schema must NOT override the locally-provided (reserved) handler.
 * The child tool must be skipped so `ownsTool` stays false and it is absent from proxied tools.
 */

import { describe, it, expect } from 'vitest';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpClientManager } from '../McpClientManager.js';
import { silentLogger } from '../../../__tests__/sa4e-testkit.js';

/** Minimal Client mock that only implements what registerServerTools uses. */
function fakeClient(toolNames: string[]): Client {
  const client = {
    listTools: async () => ({
      tools: toolNames.map((name) => ({
        name,
        description: `child tool ${name}`,
        inputSchema: { type: 'object', properties: {} },
      })),
    }),
  };
  return client as unknown as Client;
}

describe('SA4E-218: child server cannot shadow reserved (local) tools', () => {
  it('skips a child tool that collides with a reserved name', async () => {
    const mgr = new McpClientManager(silentLogger());
    mgr.setReservedToolNames(new Set(['jira_create_issue']));

    const client = fakeClient(['jira_create_issue', 'atlassian_unique_tool']);
    await (mgr as any).registerServerTools('external-atlassian', client);

    // The reserved tool must NOT be owned/proxied by the child server.
    expect(mgr.ownsTool('jira_create_issue')).toBe(false);
    const proxied = mgr.getProxiedTools().map((t) => t.name);
    expect(proxied).not.toContain('jira_create_issue');

    // Non-colliding child tools remain fully available.
    expect(mgr.ownsTool('atlassian_unique_tool')).toBe(true);
    expect(proxied).toContain('atlassian_unique_tool');
  });

  it('allows all child tools when no reservations are set', async () => {
    const mgr = new McpClientManager(silentLogger());
    mgr.setReservedToolNames(new Set());

    const client = fakeClient(['jira_create_issue']);
    await (mgr as any).registerServerTools('external-atlassian', client);

    expect(mgr.ownsTool('jira_create_issue')).toBe(true);
    expect(mgr.getProxiedTools().map((t) => t.name)).toContain('jira_create_issue');
  });
});
