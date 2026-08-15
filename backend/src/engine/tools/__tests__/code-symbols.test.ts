/**
 * SA4E-41/SA4E-53 — Unit tests for the code_symbols MCP tool registration.
 * Stub server + QueryLayer mock validate registration and output formatting
 * for both the "file" and "name" lookup branches.
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { registerCodeSymbols } from '../code-symbols.js';
import type { SymbolInfo } from '../query/query-layer.js';

function register(): {
  schema: Record<string, z.ZodTypeAny>;
  handler: (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
  queryLayer: { findSymbols: ReturnType<typeof vi.fn>; getFileSymbols: ReturnType<typeof vi.fn> };
} {
  const server = { tool: vi.fn() };
  const queryLayer = { searchCode: vi.fn(), findSymbols: vi.fn(), getFileSymbols: vi.fn() };
  registerCodeSymbols(server as never, queryLayer as never);
  const schema = (server.tool as ReturnType<typeof vi.fn>).mock.calls[0][2] as Record<string, z.ZodTypeAny>;
  const handler = (server.tool as ReturnType<typeof vi.fn>).mock.calls[0][3];
  expect((server.tool as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('code_symbols');
  return { schema, handler, queryLayer };
}

function validate(schema: Record<string, z.ZodTypeAny>, args: Record<string, unknown>): unknown {
  return z.object(schema).parse(args);
}

describe('registerCodeSymbols', () => {
  it('registers the code_symbols tool with name/kind/limit schema', () => {
    const server = { tool: vi.fn() };
    registerCodeSymbols(server as never, {} as never);
    const [name, , schema] = (server.tool as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(name).toBe('code_symbols');
    expect(schema.name).toBeDefined();
    expect(schema.file).toBeDefined();
    expect(schema.kind).toBeDefined();
    expect(schema.__projectId).toBeDefined();
  });

  it('lists symbols in a file with visibility prefix', async () => {
    const { handler, queryLayer } = register();
    queryLayer.getFileSymbols.mockResolvedValue([
      { name: 'compute', kind: 'function', signature: '', filePath: 'src/a.ts', startLine: 12, visibility: 'public' },
      { name: 'State', kind: 'interface', signature: '', filePath: 'src/a.ts', startLine: 20, visibility: null },
    ] as SymbolInfo[]);
    const out = await handler({ file: 'src/a.ts', __projectId: 'p' });
    const text = out.content[0].text;
    expect(text).toContain('Symbols in src/a.ts (2):');
    expect(text).toContain('L12 [public] function compute');
    expect(text).toContain('L20 interface State');
    expect(queryLayer.getFileSymbols).toHaveBeenCalledWith('p', 'src/a.ts');
  });

  it('searches by name prefix with kind and limit filters', async () => {
    const { handler, queryLayer } = register();
    queryLayer.findSymbols.mockResolvedValue([
      { name: 'compute', kind: 'function', signature: 'compute(x)', filePath: 'src/a.ts', startLine: 12 },
    ] as SymbolInfo[]);
    const out = await handler({ name: 'comp', kind: 'function', limit: 5, __projectId: 'p' });
    const text = out.content[0].text;
    expect(text).toContain('Found 1 symbols matching "comp":');
    expect(text).toContain('[function] compute — src/a.ts:12');
    expect(text).toContain('compute(x)');
    expect(queryLayer.findSymbols).toHaveBeenCalledWith('p', 'comp', 'function', 5);
  });

  it('applies the default limit of 50 for name lookups', async () => {
    const { handler, queryLayer, schema } = register();
    queryLayer.findSymbols.mockResolvedValue([]);
    const validated = validate(schema, { name: 'comp' });
    await handler(validated as Record<string, unknown>);
    expect(queryLayer.findSymbols).toHaveBeenCalledWith(undefined, 'comp', undefined, 50);
  });

  it('returns a guidance message when neither name nor file is given', async () => {
    const { handler } = register();
    const out = await handler({});
    expect(out.content[0].text).toBe('Provide either "name" or "file" parameter');
  });

  it('reports an empty file symbol list', async () => {
    const { handler, queryLayer } = register();
    queryLayer.getFileSymbols.mockResolvedValue([]);
    const out = await handler({ file: 'src/novel.ts' });
    expect(out.content[0].text).toBe('No symbols found in src/novel.ts');
  });
});