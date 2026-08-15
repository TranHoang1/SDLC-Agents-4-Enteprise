/**
 * SA4E-41/SA4E-53 — Unit tests for the code_search MCP tool registration.
 * Uses a stub server + QueryLayer mock to validate registration contract and
 * the text formatting of search results.
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { registerCodeSearch } from '../code-search.js';
import type { SearchResult } from '../query/query-layer.js';

interface RegisteredTool {
  schema: Record<string, z.ZodTypeAny>;
  handler: (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
  queryLayer: { searchCode: ReturnType<typeof vi.fn>; findSymbols: ReturnType<typeof vi.fn>; getFileSymbols: ReturnType<typeof vi.fn> };
}

function register(): RegisteredTool {
  const server = { tool: vi.fn() };
  const queryLayer = { searchCode: vi.fn(), findSymbols: vi.fn(), getFileSymbols: vi.fn() };
  registerCodeSearch(server as never, queryLayer as never);
  const schema = (server.tool as ReturnType<typeof vi.fn>).mock.calls[0][2] as Record<string, z.ZodTypeAny>;
  const handler = (server.tool as ReturnType<typeof vi.fn>).mock.calls[0][3];
  expect((server.tool as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('code_search');
  return { schema, handler, queryLayer };
}

function validate(schema: Record<string, z.ZodTypeAny>, args: Record<string, unknown>): unknown {
  return z.object(schema).parse(args);
}

describe('registerCodeSearch', () => {
  it('registers a tool with schema fields query/limit/__projectId', () => {
    const server = { tool: vi.fn() };
    registerCodeSearch(server as never, {} as never);
    const [name, , schema] = (server.tool as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(name).toBe('code_search');
    expect(schema.query).toBeDefined();
    expect(schema.limit).toBeDefined();
    expect(schema.__projectId).toBeDefined();
  });

  it('formats a hit list with kind, file, signature and doc', async () => {
    const { handler, queryLayer } = register();
    queryLayer.searchCode.mockResolvedValue([
      { name: 'compute', kind: 'function', signature: 'compute(x, y)', filePath: 'src/a.ts', startLine: 12, docComment: 'math helper' },
    ] as SearchResult[]);
    const out = await handler({ query: 'compute', limit: 5, __projectId: 'p' });
    const text = out.content[0].text;
    expect(text).toContain('Found 1 results for "compute":');
    expect(text).toContain('[function] compute');
    expect(text).toContain('File: src/a.ts:12');
    expect(text).toContain('Sig: compute(x, y)');
    expect(text).toContain('Doc: math helper');
    expect(queryLayer.searchCode).toHaveBeenCalledWith('p', 'compute', 5);
  });

  it('applies the default limit when not provided', async () => {
    const { handler, queryLayer, schema } = register();
    queryLayer.searchCode.mockResolvedValue([]);
    const validated = validate(schema, { query: 'sort', __projectId: 'p' });
    await handler(validated as Record<string, unknown>);
    expect(queryLayer.searchCode).toHaveBeenCalledWith('p', 'sort', 20);
  });

  it('truncates long signatures and doc comments', async () => {
    const { handler, queryLayer } = register();
    queryLayer.searchCode.mockResolvedValue([
      { name: 'big', kind: 'function', signature: 'x'.repeat(200), filePath: 'f.ts', startLine: 1, docComment: 'y'.repeat(200) },
    ] as SearchResult[]);
    const out = await handler({ query: 'big', limit: 10 });
    const text = out.content[0].text;
    const sig = text.split('\n').find(l => l.startsWith('  Sig: '))!;
    expect(sig.length).toBeLessThanOrEqual(120 + '  Sig: '.length);
    const doc = text.split('\n').find(l => l.startsWith('  Doc: '))!;
    expect(doc.length).toBeLessThanOrEqual(100 + '  Doc: '.length);
  });

  it('returns a friendly message when no results are found', async () => {
    const { handler, queryLayer } = register();
    queryLayer.searchCode.mockResolvedValue([]);
    const out = await handler({ query: 'zzz', limit: 20 });
    expect(out.content[0].text).toBe('No results found for "zzz"');
  });
});