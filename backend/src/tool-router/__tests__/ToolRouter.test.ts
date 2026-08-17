/**
 * ToolRouter unit tests — routing, timeout boundary, structured error handling.
 */

import { describe, it, expect, vi } from 'vitest';
import { ToolRouter } from '../ToolRouter.js';
import type { ToolHandler, ToolDefinition, ToolCallRequest, ToolResult } from '../../types/tool.js';

function ok(text: string): ToolResult {
  return { content: [{ type: 'text', text }], isError: false };
}

function makeLogger() {
  return { warn: vi.fn(), debug: vi.fn(), error: vi.fn(), info: vi.fn() } as any;
}

function makeRouter(
  handlers: Map<string, ToolHandler>,
  defs: ToolDefinition[] = [],
  toolTimeoutMs?: number,
) {
  const registry: any = {
    getToolHandlers: () => handlers,
    getAllToolDefinitions: () => defs,
  };
  return new ToolRouter(registry, makeLogger(), toolTimeoutMs);
}

const REQ = (tool_name: string, args: Record<string, unknown> = {}): ToolCallRequest => ({ tool_name, arguments: args });

describe('ToolRouter.route', () => {
  it('forwards args and returns the handler result', async () => {
    const handler: ToolHandler = vi.fn(async (args) => ok(`got:${String(args.x)}`));
    const router = makeRouter(new Map([['echo', handler]]));
    const result = await router.route(REQ('echo', { x: 42 }));
    expect(handler).toHaveBeenCalledWith({ x: 42 });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toBe('got:42');
  });

  it('returns an error for an unknown tool', async () => {
    const router = makeRouter(new Map());
    const result = await router.route(REQ('nope', {}));
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("Tool 'nope' not found");
  });

  it('wraps a throwing handler into an error ToolResult', async () => {
    const handler: ToolHandler = async () => { throw new Error('boom'); };
    const router = makeRouter(new Map([['bad', handler]]));
    const result = await router.route(REQ('bad', {}));
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Tool execution failed: boom');
  });

  it('stringifies non-Error throws', async () => {
    const handler: ToolHandler = async () => { throw 'plain-string-failure'; };
    const router = makeRouter(new Map([['bad', handler]]));
    const result = await router.route(REQ('bad', {}));
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Tool execution failed: plain-string-failure');
  });

  it('passes through an isError result untouched', async () => {
    const handler: ToolHandler = async () => ({ content: [{ type: 'text', text: 'user-level failure' }], isError: true });
    const router = makeRouter(new Map([['fails', handler]]));
    const result = await router.route(REQ('fails', {}));
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('user-level failure');
  });

  it('rejects with a timeout error when handler exceeds the boundary', async () => {
    const handler: ToolHandler = async () => new Promise<never>(() => {});
    const router = makeRouter(new Map([['slow', handler]]), [], 100);
    const result = await router.route(REQ('slow', {}));
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('timed out after 100ms');
  });
});

describe('ToolRouter tool listing', () => {
  const DEFS: ToolDefinition[] = [
    { name: 'a', description: 'd', inputSchema: {}, category: 'code' },
    { name: 'b', description: 'd', inputSchema: {}, category: 'memory' },
  ];

  it('listTools delegates to the registry', () => {
    const router = makeRouter(new Map(), DEFS);
    expect(router.listTools()).toEqual(DEFS);
  });

  it('hasTools is true when definitions exist', () => {
    const router = makeRouter(new Map(), DEFS);
    expect(router.hasTools()).toBe(true);
  });

  it('hasTools is false with no definitions', () => {
    const router = makeRouter(new Map(), []);
    expect(router.hasTools()).toBe(false);
  });

  it('getToolCount returns the number of definitions', () => {
    const router = makeRouter(new Map(), DEFS);
    expect(router.getToolCount()).toBe(2);
  });
});