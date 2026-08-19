/**
 * SA4E-85 - KiroAgentRegistry (Task 3.1 + 3.5).
 * Discovers agents from .code-intel/agents/*.md using FileSystemWatcher.
 * Observer Pattern: emits onAgentsChanged on add/remove/update.
 * Hot-reload <2s via 300ms debounced watcher with incremental diff (BR-11).
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import type { AgentMeta } from '../types';
import type { IAgentRegistry } from './IAgentRegistry';
import { parseAgentFile } from './agentParser';

/** Debounce delay for filesystem watcher (ms) */
const DEBOUNCE_MS = 300;

/** Glob pattern for agent definition files */
const AGENT_GLOB = '**/.code-intel/agents/*.md';

/**
 * Concrete implementation of IAgentRegistry.
 * Scans workspace for agent .md files and watches for changes.
 * Uses debounced full-rescan with diff comparison for efficiency.
 */
export class KiroAgentRegistry implements IAgentRegistry {
  private agents: Map<string, AgentMeta> = new Map();
  private watcher: vscode.FileSystemWatcher | undefined;
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly outputChannel: vscode.OutputChannel;

  private readonly _onAgentsChanged = new vscode.EventEmitter<AgentMeta[]>();
  public readonly onAgentsChanged = this._onAgentsChanged.event;

  constructor(
    private readonly workspaceRoot: string,
    outputChannel?: vscode.OutputChannel,
  ) {
    this.outputChannel = outputChannel ??
      vscode.window.createOutputChannel('Agent Registry');
  }

  /** Get all currently registered agents as array */
  getAgents(): AgentMeta[] {
    return Array.from(this.agents.values());
  }

  /** Get a specific agent by ID */
  getAgent(agentId: string): AgentMeta | undefined {
    return this.agents.get(agentId);
  }

  /** Perform initial scan and start filesystem watcher */
  startWatching(): void {
    this.performScan();
    this.setupWatcher();
  }

  /** Dispose watcher and emitter resources */
  dispose(): void {
    this.watcher?.dispose();
    this._onAgentsChanged.dispose();
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  /** Setup FileSystemWatcher for agent files */
  private setupWatcher(): void {
    const pattern = new vscode.RelativePattern(
      this.workspaceRoot, AGENT_GLOB,
    );
    this.watcher = vscode.workspace.createFileSystemWatcher(pattern);

    this.watcher.onDidCreate(() => this.debouncedRescan());
    this.watcher.onDidChange(() => this.debouncedRescan());
    this.watcher.onDidDelete(() => this.debouncedRescan());
  }

  /**
   * Debounced rescan - waits 300ms after last event before scanning.
   * Prevents excessive rescans during bulk file operations (BR-11).
   */
  private debouncedRescan(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.performScan(), DEBOUNCE_MS);
  }

  /**
   * Full rescan of agent directory with diff comparison.
   * Only emits onAgentsChanged if the agent list actually changed.
   */
  private performScan(): void {
    const agentsDir = path.join(
      this.workspaceRoot, '.code-intel', 'agents',
    );

    const newAgents = this.scanDirectory(agentsDir);
    if (this.hasChanges(newAgents)) {
      this.agents = newAgents;
      this._onAgentsChanged.fire(this.getAgents());
    }
  }

  /** Scan directory for .md files and parse each into AgentMeta */
  private scanDirectory(dirPath: string): Map<string, AgentMeta> {
    const result = new Map<string, AgentMeta>();

    if (!fs.existsSync(dirPath)) return result;

    const files = fs.readdirSync(dirPath)
      .filter((f) => f.endsWith('.md'));

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const meta = this.parseFile(filePath);
      if (meta) result.set(meta.id, meta);
    }

    return result;
  }

  /** Read and parse a single agent file */
  private parseFile(filePath: string): AgentMeta | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return parseAgentFile(content, filePath, (msg) =>
        this.outputChannel.appendLine(msg),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.outputChannel.appendLine(
        `[AgentRegistry] Failed to read ${filePath}: ${message}`,
      );
      return null;
    }
  }

  /**
   * Compare new agent map against current for changes.
   * Checks size, keys, and serialized values for differences.
   */
  private hasChanges(newAgents: Map<string, AgentMeta>): boolean {
    if (newAgents.size !== this.agents.size) return true;

    for (const [id, newMeta] of newAgents) {
      const existing = this.agents.get(id);
      if (!existing) return true;
      if (!this.isEqual(existing, newMeta)) return true;
    }

    return false;
  }

  /** Shallow equality check for two AgentMeta objects */
  private isEqual(a: AgentMeta, b: AgentMeta): boolean {
    return (
      a.id === b.id &&
      a.name === b.name &&
      a.description === b.description &&
      a.filePath === b.filePath &&
      arraysEqual(a.tools, b.tools) &&
      arraysEqual(a.mcpServers, b.mcpServers) &&
      arraysEqual(a.autoApprove, b.autoApprove)
    );
  }
}

/** Compare two string arrays (or undefined) for equality */
function arraysEqual(a: string[] | undefined, b: string[] | undefined): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined) return false;
  if (a.length !== b.length) return false;
  return a.every((val, i) => val === b[i]);
}
