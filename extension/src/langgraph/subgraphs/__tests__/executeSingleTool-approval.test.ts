/**
 * SA4E-85 — Integration test: executeSingleTool pauses for approval.
 * Reproduces the bug: dangerous tool executes immediately without waiting.
 * After fix: tool waits for ToolApprovalGate before proceeding.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToolApprovalGate } from '../../../chat/engine/ToolApprovalGate';

// Mock vscode-tools to avoid real filesystem calls
vi.mock('../../vscode/vscode-tools', () => ({
  VSCODE_TOOL_DEFINITIONS: [],
  isVscodeTool: () => false,
  executeVscodeTool: vi.fn().mockResolvedValue('vscode-result'),
}));

// Minimal mock for StreamHandler
function createMockStreamHandler() {
  return { emitDirect: vi.fn(), emitStatus: vi.fn(), emitToken: vi.fn(), emitComplete: vi.fn(), emitError: vi.fn() };
}

// Minimal mock for McpBridge
function createMockMcpBridge(result = 'tool-output') {
  return { callTool: vi.fn().mockResolvedValue(result) };
}

import { createExecuteToolsNode } from '../chat-graph-nodes';

describe('executeSingleTool — approval gate integration', () => {
  let gate: ToolApprovalGate;

  beforeEach(() => {
    vi.useFakeTimers();
    gate = new ToolApprovalGate(30_000);
  });

  afterEach(() => {
    gate.dispose();
    vi.useRealTimers();
  });

  it('should WAIT for approval before executing a dangerous tool', async () => {
    const sh = createMockStreamHandler();
    const mcp = createMockMcpBridge('command output');
    const executeNode = createExecuteToolsNode(mcp as any, sh as any, undefined, '/ws', gate);

    const state = {
      toolCalls: [{ id: 'tc-1', name: 'shell_execute', arguments: { cmd: 'echo hi' } }],
      currentStreamId: 'stream-1',
      agentScratchpad: [],
      maxContextTokens: 0,
    } as any;

    // Start execution — it should block at the gate
    const resultPromise = executeNode(state);
    let resolved = false;
    resultPromise.then(() => { resolved = true; });

    // Yield microtasks — tool should NOT have been called yet
    await vi.advanceTimersByTimeAsync(10);
    expect(mcp.callTool).not.toHaveBeenCalled();
    expect(resolved).toBe(false);

    // User approves
    gate.resolveApproval('tc-1', 'approve');
    await vi.advanceTimersByTimeAsync(10);

    const result = await resultPromise;
    expect(mcp.callTool).toHaveBeenCalledWith('shell_execute', { cmd: 'echo hi' });
    expect(result.toolResults[0].content).toBe('command output');
  });

  it('should return denial message when user rejects', async () => {
    const sh = createMockStreamHandler();
    const mcp = createMockMcpBridge();
    const executeNode = createExecuteToolsNode(mcp as any, sh as any, undefined, '/ws', gate);

    const state = {
      toolCalls: [{ id: 'tc-rej', name: 'git_push', arguments: { remote: 'origin' } }],
      currentStreamId: 'stream-2',
      agentScratchpad: [],
      maxContextTokens: 0,
    } as any;

    const resultPromise = executeNode(state);

    await vi.advanceTimersByTimeAsync(5);
    gate.resolveApproval('tc-rej', 'reject');
    await vi.advanceTimersByTimeAsync(5);

    const result = await resultPromise;
    expect(mcp.callTool).not.toHaveBeenCalled();
    expect(result.toolResults[0].content).toBe('Tool execution denied by user.');
  });

  it('should auto-reject on timeout for dangerous tool', async () => {
    const sh = createMockStreamHandler();
    const mcp = createMockMcpBridge();
    const executeNode = createExecuteToolsNode(mcp as any, sh as any, undefined, '/ws', gate);

    const state = {
      toolCalls: [{ id: 'tc-to', name: 'delete_file', arguments: { path: '/x' } }],
      currentStreamId: 'stream-3',
      agentScratchpad: [],
      maxContextTokens: 0,
    } as any;

    const resultPromise = executeNode(state);

    // Advance past timeout (30s)
    await vi.advanceTimersByTimeAsync(30_001);

    const result = await resultPromise;
    expect(mcp.callTool).not.toHaveBeenCalled();
    expect(result.toolResults[0].content).toBe('Auto-rejected. Retry available.');
  });

  it('should NOT block safe tools (bypass gate entirely)', async () => {
    const sh = createMockStreamHandler();
    const mcp = createMockMcpBridge('search results');
    const executeNode = createExecuteToolsNode(mcp as any, sh as any, undefined, '/ws', gate);

    // grep_search is in SAFE list and not a vscode tool → goes to mcpBridge
    const state = {
      toolCalls: [{ id: 'tc-safe', name: 'grep_search', arguments: { query: 'foo' } }],
      currentStreamId: 'stream-4',
      agentScratchpad: [],
      maxContextTokens: 0,
    } as any;

    // Should resolve immediately — no gate blocking
    const result = await executeNode(state);
    expect(mcp.callTool).toHaveBeenCalledWith('grep_search', { query: 'foo' });
    expect(result.toolResults[0].content).toBe('search results');
    expect(gate.pendingCount).toBe(0);
  });

  // SA4E-185 B1/C-2: fs_write / str_replace / fs_append moved from default-safe to DANGEROUS.
  it.each(['fs_write', 'str_replace', 'fs_append'])(
    'should WAIT for approval before executing %s (auto-fix write family)',
    async (toolName) => {
      const sh = createMockStreamHandler();
      const mcp = createMockMcpBridge('write result');
      const executeNode = createExecuteToolsNode(mcp as any, sh as any, undefined, '/ws', gate);

      const state = {
        toolCalls: [{ id: `tc-write-${toolName}`, name: toolName, arguments: { file_path: '/ws/a.ts', content: 'x' } }],
        currentStreamId: `stream-write-${toolName}`,
        agentScratchpad: [],
        maxContextTokens: 0,
      } as any;

      const resultPromise = executeNode(state);
      let resolved = false;
      resultPromise.then(() => { resolved = true; });

      // Tool must NOT run before approval
      await vi.advanceTimersByTimeAsync(10);
      expect(mcp.callTool).not.toHaveBeenCalled();
      expect(resolved).toBe(false);

      // Approve → tool executes
      gate.resolveApproval(`tc-write-${toolName}`, 'approve');
      await vi.advanceTimersByTimeAsync(10);

      const result = await resultPromise;
      expect(mcp.callTool).toHaveBeenCalledWith(toolName, { file_path: '/ws/a.ts', content: 'x' });
      expect(result.toolResults[0].content).toBe('write result');
    }
  );
});
