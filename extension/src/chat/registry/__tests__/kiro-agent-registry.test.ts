/**
 * SA4E-85 — Unit Tests: KiroAgentRegistry (UT-KAR-01/02/03).
 * Tests agent discovery, debounced hot-reload, and change events.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type * as vscode from 'vscode';
import { KiroAgentRegistry } from '../KiroAgentRegistry';

const mocks = vi.hoisted(() => {
  const noopWatcher = {
    onDidCreate: () => ({ dispose: () => undefined }),
    onDidChange: () => ({ dispose: () => undefined }),
    onDidDelete: () => ({ dispose: () => undefined }),
    dispose: () => undefined,
  };
  return {
    createFileSystemWatcher: vi.fn(() => noopWatcher),
  };
});

vi.mock('vscode', async () => {
  const actual = await vi.importActual<typeof import('vscode')>('vscode');
  return {
    ...actual,
    RelativePattern: class RelativePattern {
      constructor(
        public base: string,
        public pattern: string,
      ) {}
    },
    workspace: {
      ...actual.workspace,
      createFileSystemWatcher: mocks.createFileSystemWatcher,
    },
  };
});

function writeAgentFile(agentsDir: string, fileName: string, fields: Record<string, string | string[]>): void {
  const lines = Object.entries(fields).map(([key, value]) => {
    if (Array.isArray(value)) {
      return `${key}:\n${value.map((item) => `  - ${item}`).join('\n')}`;
    }
    return `${key}: ${value}`;
  });
  fs.writeFileSync(
    path.join(agentsDir, `${fileName}.md`),
    `---\n${lines.join('\n')}\n---\n# Agent Body`,
  );
}

describe('UT-KAR-01: Agent Discovery', () => {
  let tempRoot: string;
  let agentsDir: string;
  let outputChannel: { appendLine: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-reg-'));
    agentsDir = path.join(tempRoot, '.code-intel', 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });
    writeAgentFile(agentsDir, 'agent-a', { id: 'agent-a', name: 'Agent A', tools: ['read_file'] });
    writeAgentFile(agentsDir, 'agent-b', { id: 'agent-b', name: 'Agent B', tools: ['write_file'] });
    outputChannel = { appendLine: vi.fn() };
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('discovers all agent files on startWatching', () => {
    const registry = new KiroAgentRegistry(
      tempRoot,
      outputChannel as unknown as vscode.OutputChannel,
    );
    registry.startWatching();
    const agents = registry.getAgents();
    expect(agents).toHaveLength(2);
    expect(agents.map((a) => a.id).sort()).toEqual(['agent-a', 'agent-b']);
  });

  it('returns a specific agent by id', () => {
    const registry = new KiroAgentRegistry(
      tempRoot,
      outputChannel as unknown as vscode.OutputChannel,
    );
    registry.startWatching();
    const agent = registry.getAgent('agent-a');
    expect(agent).toBeDefined();
    expect(agent!.name).toBe('Agent A');
    expect(agent!.tools).toEqual(['read_file']);
    expect(registry.getAgent('missing-agent')).toBeUndefined();
  });

  it('returns a fresh array on each getAgents call', () => {
    const registry = new KiroAgentRegistry(
      tempRoot,
      outputChannel as unknown as vscode.OutputChannel,
    );
    registry.startWatching();
    expect(registry.getAgents()).not.toBe(registry.getAgents());
  });

  it('is empty when the agents directory does not exist', () => {
    const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-empty-'));
    try {
      const registry = new KiroAgentRegistry(
        emptyRoot,
        outputChannel as unknown as vscode.OutputChannel,
      );
      registry.startWatching();
      expect(registry.getAgents()).toEqual([]);
    } finally {
      fs.rmSync(emptyRoot, { recursive: true, force: true });
    }
  });
});

describe('UT-KAR-02: Debounced Hot-Reload', () => {
  let tempRoot: string;
  let agentsDir: string;
  let outputChannel: { appendLine: ReturnType<typeof vi.fn> };
  let watcherCallbacks: Record<string, (() => void) | undefined>;
  let registry: KiroAgentRegistry;

  beforeEach(() => {
    vi.useFakeTimers();
    mocks.createFileSystemWatcher.mockReset();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-reg-'));
    agentsDir = path.join(tempRoot, '.code-intel', 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });
    writeAgentFile(agentsDir, 'agent-a', { id: 'agent-a', name: 'Agent A' });
    outputChannel = { appendLine: vi.fn() };
    watcherCallbacks = {};
    const fakeWatcher = {
      onDidCreate: (cb: () => void) => { watcherCallbacks.create = cb; return { dispose: () => undefined }; },
      onDidChange: (cb: () => void) => { watcherCallbacks.change = cb; return { dispose: () => undefined }; },
      onDidDelete: (cb: () => void) => { watcherCallbacks.delete = cb; return { dispose: () => undefined }; },
      dispose: vi.fn(),
    };
    mocks.createFileSystemWatcher.mockReturnValue(fakeWatcher);
    registry = new KiroAgentRegistry(
      tempRoot,
      outputChannel as unknown as vscode.OutputChannel,
    );
    registry.startWatching();
  });

  afterEach(() => {
    registry.dispose();
    vi.useRealTimers();
    fs.rmSync(tempRoot, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('uses a RelativePattern scoped to the workspace root', () => {
    expect(mocks.createFileSystemWatcher).toHaveBeenCalledTimes(1);
    const pattern = mocks.createFileSystemWatcher.mock.calls[0][0];
    expect(pattern).toBeInstanceOf(Object);
    expect(pattern.base).toBe(tempRoot);
  });

  it('picks up newly created agent files after the debounce window', () => {
    const listener = vi.fn();
    registry.onAgentsChanged(listener);
    writeAgentFile(agentsDir, 'agent-c', { id: 'agent-c', name: 'Agent C' });
    watcherCallbacks.create!();
    expect(listener).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(registry.getAgents()).toHaveLength(2);
  });

  it('reflects content changes after the debounce window', () => {
    writeAgentFile(agentsDir, 'agent-a', { id: 'agent-a', name: 'Agent A Updated' });
    watcherCallbacks.change!();
    vi.advanceTimersByTime(300);
    expect(registry.getAgent('agent-a')!.name).toBe('Agent A Updated');
  });

  it('removes deleted agent files after the debounce window', () => {
    const listener = vi.fn();
    registry.onAgentsChanged(listener);
    fs.rmSync(path.join(agentsDir, 'agent-a.md'));
    watcherCallbacks.delete!();
    vi.advanceTimersByTime(300);
    expect(registry.getAgent('agent-a')).toBeUndefined();
    expect(registry.getAgents()).toHaveLength(0);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not fire the event when nothing changed', () => {
    const listener = vi.fn();
    registry.onAgentsChanged(listener);
    watcherCallbacks.change!();
    vi.advanceTimersByTime(300);
    expect(listener).not.toHaveBeenCalled();
  });

  it('coalesces rapid events into a single rescan', () => {
    const listener = vi.fn();
    registry.onAgentsChanged(listener);
    writeAgentFile(agentsDir, 'agent-c', { id: 'agent-c', name: 'Agent C' });
    writeAgentFile(agentsDir, 'agent-d', { id: 'agent-d', name: 'Agent D' });
    watcherCallbacks.create!();
    watcherCallbacks.create!();
    vi.advanceTimersByTime(300);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(registry.getAgents()).toHaveLength(3);
  });
});

describe('UT-KAR-03: Lifecycle', () => {
  it('dispose stops watching and clears the emitter', () => {
    vi.useFakeTimers();
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-reg-'));
    const agentsDir = path.join(tempRoot, '.code-intel', 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });
    writeAgentFile(agentsDir, 'agent-a', { id: 'agent-a', name: 'Agent A' });
    const outputChannel = { appendLine: vi.fn() };
    let onDidCreate: (() => void) | undefined;
    const fakeWatcher = {
      onDidCreate: (cb: () => void) => { onDidCreate = cb; return { dispose: () => undefined }; },
      onDidChange: () => ({ dispose: () => undefined }),
      onDidDelete: () => ({ dispose: () => undefined }),
      dispose: vi.fn(),
    };
    mocks.createFileSystemWatcher.mockReturnValue(fakeWatcher);

    const registry = new KiroAgentRegistry(
      tempRoot,
      outputChannel as unknown as vscode.OutputChannel,
    );
    registry.startWatching();
    const listener = vi.fn();
    registry.onAgentsChanged(listener);
    registry.dispose();

    writeAgentFile(agentsDir, 'agent-b', { id: 'agent-b', name: 'Agent B' });
    onDidCreate!();
    vi.advanceTimersByTime(300);
    expect(listener).not.toHaveBeenCalled();
    expect(fakeWatcher.dispose).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
    fs.rmSync(tempRoot, { recursive: true, force: true });
    vi.clearAllMocks();
  });
});
