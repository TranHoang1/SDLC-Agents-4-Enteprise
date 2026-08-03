/**
 * SA4E-85 — Service Discovery (Task 7.1).
 * Watches .code-intel/.run/*.json for service registration files.
 * Parses ws_endpoint and validates localhost-only (BR-14).
 * Auto-disconnects on file deletion via FileSystemWatcher.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import type { ServiceDiscovery } from './IIpcBridge';

/** Allowed localhost patterns for BR-14 validation */
const LOCALHOST_PATTERNS: RegExp[] = [
  /^wss?:\/\/localhost(:\d+)?/,
  /^wss?:\/\/127\.0\.0\.1(:\d+)?/,
  /^wss?:\/\/\[::1\](:\d+)?/,
];

/**
 * Validate that a ws_endpoint is localhost-only (BR-14).
 * Rejects any non-local WebSocket endpoint for security.
 */
export function isLocalhostEndpoint(endpoint: string): boolean {
  return LOCALHOST_PATTERNS.some((pattern) => pattern.test(endpoint));
}

/**
 * Parse a service discovery JSON file.
 * @returns ServiceDiscovery if valid, null if malformed or non-local
 */
export function parseDiscoveryFile(content: string): ServiceDiscovery | null {
  try {
    const data = JSON.parse(content) as Partial<ServiceDiscovery>;
    if (!data.ws_endpoint || !data.rest_endpoint || !data.pid) {
      return null;
    }
    if (!isLocalhostEndpoint(data.ws_endpoint)) {
      return null;
    }
    return {
      ws_endpoint: data.ws_endpoint,
      rest_endpoint: data.rest_endpoint,
      pid: data.pid,
      status: data.status ?? 'unknown',
      version: data.version ?? '0.0.0',
      started_at: data.started_at ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/** Extract service ID from a discovery filename (e.g., "kiro.json" -> "kiro") */
export function serviceIdFromPath(filePath: string): string {
  return path.basename(filePath, '.json');
}

/** Callback for discovery events */
export interface DiscoveryListener {
  onServiceFound(serviceId: string, discovery: ServiceDiscovery): void;
  onServiceRemoved(serviceId: string): void;
}

/**
 * ServiceDiscoveryWatcher — FileSystemWatcher for .run/*.json.
 * Emits events when services appear or disappear.
 */
export class ServiceDiscoveryWatcher implements vscode.Disposable {
  private watcher: vscode.FileSystemWatcher | undefined;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly workspaceRoot: string,
    private readonly listener: DiscoveryListener,
  ) {}

  /** Start watching for service discovery files */
  start(): void {
    const runDir = path.join(this.workspaceRoot, '.code-intel', '.run');
    const pattern = new vscode.RelativePattern(runDir, '*.json');

    this.watcher = vscode.workspace.createFileSystemWatcher(pattern);
    this.disposables.push(this.watcher);

    this.watcher.onDidCreate((uri) => this.handleFileChange(uri), null, this.disposables);
    this.watcher.onDidChange((uri) => this.handleFileChange(uri), null, this.disposables);
    this.watcher.onDidDelete((uri) => this.handleFileDeletion(uri), null, this.disposables);

    // Scan existing files on startup
    this.scanExisting(runDir);
  }

  /** Scan existing .run/*.json files at startup */
  private scanExisting(runDir: string): void {
    try {
      if (!fs.existsSync(runDir)) return;
      const files = fs.readdirSync(runDir).filter((f) => f.endsWith('.json'));
      for (const file of files) {
        const fullPath = path.join(runDir, file);
        this.processFile(fullPath);
      }
    } catch {
      // Directory may not exist yet — non-fatal
    }
  }

  private handleFileChange(uri: vscode.Uri): void {
    this.processFile(uri.fsPath);
  }

  private handleFileDeletion(uri: vscode.Uri): void {
    const serviceId = serviceIdFromPath(uri.fsPath);
    this.listener.onServiceRemoved(serviceId);
  }

  private processFile(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const discovery = parseDiscoveryFile(content);
      if (discovery) {
        const serviceId = serviceIdFromPath(filePath);
        this.listener.onServiceFound(serviceId, discovery);
      }
    } catch {
      // File read error — skip silently
    }
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
  }
}
