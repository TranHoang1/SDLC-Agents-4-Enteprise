/**
 * ToolHandlerDecorators unit tests — composable handler wrappers.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  withErrorHandling,
  withScopeContext,
  withProjectId,
  withResultFormat,
  withTextResult,
  compose,
} from '../ToolHandlerDecorators.js';
import type { ToolResult, ToolHandler } from '../../types/tool.js';

function ok(text: string): ToolResult {
  return { content: [{ type: 'text', text }], isError: false };
}

function resultOf(r: ToolResult | undefined): string | undefined {
  return r?.content[0]?.type === 'text' ? r.content[0].text : undefined;
}

describe('withErrorHandling', () => {
  it('passes through the successful result', async () => {
    const logger: any = { error: vi.fn() };
    const wrapped = withErrorHandling(logger, 'toolA')(async () => ok('ok'));
    const r = await wrapped({});
    expect(r.isError).toBe(false);
    expect(resultOf(r)).toBe('ok');
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('converts a thrown Error into an error result and logs', async () => {
    const logger: any = { error: vi.fn() };
    const wrapped = withErrorHandling(logger, 'toolA')(async () => { throw new Error('kaput'); });
    const r = await wrapped({});
    expect(r.isError).toBe(true);
    expect(resultOf(r)).toBe('Error: kaput');
    expect(logger.error).toHaveBeenCalledWith({ tool: 'toolA', err: expect.any(Error) }, 'Tool execution failed');
  });

  it('stringifies non-Error throws', async () => {
    const wrapped = withErrorHandling({ error: vi.fn() } as any, 'toolA')(async () => { throw 1234; });
    const r = await wrapped({});
    expect(r.isError).toBe(true);
    expect(resultOf(r)).toBe('Error: 1234');
  });
});

describe('withScopeContext', () => {
  it('uses _projectContext when present', async () => {
    const dispatcher = { setScopeContext: vi.fn() };
    const next: ToolHandler = vi.fn(async () => ok('ok'));
    const wrapped = withScopeContext(dispatcher)(next);
    await wrapped({ _projectContext: { userId: 'u1', projectId: 'p1' } });
    expect(dispatcher.setScopeContext).toHaveBeenCalledWith({ userId: 'u1', projectId: 'p1' });
    expect(next).toHaveBeenCalledWith({ _projectContext: { userId: 'u1', projectId: 'p1' } });
  });

  it('falls back to __userId / __projectId stamps', async () => {
    const dispatcher = { setScopeContext: vi.fn() };
    const wrapped = withScopeContext(dispatcher)(async (): Promise<ToolResult> => ok('ok'));
    await wrapped({ __userId: 'u2', __projectId: 'p2' });
    expect(dispatcher.setScopeContext).toHaveBeenCalledWith({ userId: 'u2', projectId: 'p2' });
  });

  it('defaults empty userId when only __projectId is provided', async () => {
    const dispatcher = { setScopeContext: vi.fn() };
    const wrapped = withScopeContext(dispatcher)(async (): Promise<ToolResult> => ok('ok'));
    await wrapped({ __projectId: 'p3' });
    expect(dispatcher.setScopeContext).toHaveBeenCalledWith({ userId: '', projectId: 'p3' });
  });

  it('clears scope to undefined when no context keys are present', async () => {
    const dispatcher = { setScopeContext: vi.fn() };
    const wrapped = withScopeContext(dispatcher)(async (): Promise<ToolResult> => ok('ok'));
    await wrapped({ plain: 'arg' });
    expect(dispatcher.setScopeContext).toHaveBeenCalledWith(undefined);
  });
});

describe('withProjectId', () => {
  it('passes __projectId through and wraps the string result', async () => {
    const next = vi.fn(async (_args: Record<string, unknown>, projectId?: string) => `rendered:${projectId}`);
    const wrapped = withProjectId(next);
    const r = await wrapped({ __projectId: 'proj-9' });
    expect(next).toHaveBeenCalledWith({ __projectId: 'proj-9' }, 'proj-9');
    expect(r.isError).toBe(false);
    expect(resultOf(r)).toBe('rendered:proj-9');
  });

  it('passes undefined projectId when absent', async () => {
    const next = vi.fn(async (_args: Record<string, unknown>, projectId?: string) => `pid=${projectId}`);
    const r = await withProjectId(next)({ nope: 1 });
    expect(next).toHaveBeenCalledWith({ nope: 1 }, undefined);
    expect(resultOf(r)).toBe('pid=undefined');
  });
});

describe('withResultFormat', () => {
  it('wraps a non-null string as a success result', async () => {
    const r = await withResultFormat(async () => 'data here')({});
    expect(r.isError).toBe(false);
    expect(resultOf(r)).toBe('data here');
  });

  it('returns an error result for null', async () => {
    const r = await withResultFormat(async () => null)({});
    expect(r.isError).toBe(true);
    expect(resultOf(r)).toBe('Unknown tool');
  });
});

describe('withTextResult', () => {
  it('wraps plain text as a success result', async () => {
    const r = await withTextResult(async () => 'plain text')({});
    expect(r.isError).toBe(false);
    expect(resultOf(r)).toBe('plain text');
  });
});

describe('compose', () => {
  it('applies decorators right-to-left', async () => {
    const calls: string[] = [];
    const mark = (name: string) => (next: any) => async (args: unknown) => { calls.push(name); return next(args); };
    const base = async () => 'base';
    const composed = compose<(args: unknown) => Promise<string>>(mark('outer'), mark('inner'))(base as any);
    const out = await composed({});
    expect(out).toBe('base');
    expect(calls).toEqual(['outer', 'inner']);
  });

  it('composes with withErrorHandling and withTextResult', async () => {
    const logger: any = { error: vi.fn() };
    const handler: ToolHandler = compose<ToolHandler>(withErrorHandling(logger, 't'), withTextResult)(async () => 'hello' as any);
    const r = await handler({});
    expect(r.isError).toBe(false);
    expect(resultOf(r)).toBe('hello');
  });
});