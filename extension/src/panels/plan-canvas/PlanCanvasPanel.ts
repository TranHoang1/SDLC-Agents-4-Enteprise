/**
 * PlanCanvasPanel — Visual STATUS.json display panel for the SDLC pipeline.
 * SA4E-132: Reads documents/{TICKET}/STATUS.json and renders color-coded phase diagram.
 * Implements BR-801 (color coding) and BR-802 (auto-refresh on file change).
 */

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { WebviewToExtMessage } from "../../types";
import { IServerManager } from "../../types/server-types";
import { BasePanel } from "../base-panel";
import { renderCanvasBody, getCanvasCss } from "./plan-canvas-renderer";
import { loadAllPipelines, findStatusFiles } from "./status-json-loader";

export class PlanCanvasPanel extends BasePanel {
  private fileWatchers: fs.FSWatcher[] = [];
  private refreshDebounce: NodeJS.Timeout | undefined;

  constructor(mcpManager: IServerManager, extensionUri: vscode.Uri) {
    super("planCanvas", mcpManager, extensionUri);
    this.setupFileWatchers();
  }

  /** Generate the full webview HTML with inline CSS and pipeline phases. */
  getHtml(webview: vscode.Webview): string {
    const nonce = this.getNonce();
    const cspSource = webview.cspSource;
    const pipelines = this.loadPipelines();
    const bodyHtml = renderCanvasBody(pipelines);
    const css = getCanvasCss();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>Plan Canvas</title>
    <style>${css}</style>
</head>
<body>
    <button id="refresh-btn" title="Refresh">&#x21BB; Refresh</button>
    ${bodyHtml}
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      document.getElementById('refresh-btn').addEventListener('click', () => {
        vscode.postMessage({ type: 'refresh' });
      });
      vscode.postMessage({ type: 'ready' });
    </script>
</body>
</html>`;
  }

  /** Load pipeline data and reload the webview HTML. */
  async loadData(): Promise<void> {
    this.reload();
  }

  /** Handle messages from the webview. */
  async handleMessage(msg: WebviewToExtMessage): Promise<void> {
    switch (msg.type) {
      case "ready":
      case "refresh":
        this.reload();
        break;
    }
  }

  /** Dispose file watchers on panel close. */
  dispose(): void {
    this.disposeWatchers();
    clearTimeout(this.refreshDebounce);
    super.dispose();
  }

  /** Load pipelines from workspace documents folder. */
  private loadPipelines() {
    const root = this.getWorkspaceRoot();
    if (!root) { return []; }
    return loadAllPipelines(root);
  }

  /**
   * BR-802: Watch STATUS.json files for changes and auto-refresh.
   * Uses fs.watch with debounce to avoid excessive reloads.
   */
  private setupFileWatchers(): void {
    const root = this.getWorkspaceRoot();
    if (!root) { return; }
    const files = findStatusFiles(root);
    for (const file of files) {
      this.watchFile(file);
    }
    // Also watch the documents directory for new STATUS.json files
    const docsDir = path.join(root, "documents");
    if (fs.existsSync(docsDir)) {
      this.watchDirectory(docsDir);
    }
  }

  /** Watch a single STATUS.json for changes. */
  private watchFile(filePath: string): void {
    try {
      const watcher = fs.watch(filePath, () => this.debouncedRefresh());
      this.fileWatchers.push(watcher);
    } catch { /* file may not be watchable — graceful degrade */ }
  }

  /** Watch documents directory for new ticket folders. */
  private watchDirectory(dirPath: string): void {
    try {
      const watcher = fs.watch(dirPath, () => this.debouncedRefresh());
      this.fileWatchers.push(watcher);
    } catch { /* directory may not be watchable — graceful degrade */ }
  }

  /** Debounce refresh to within 5s (BR-802 compliance). */
  private debouncedRefresh(): void {
    clearTimeout(this.refreshDebounce);
    this.refreshDebounce = setTimeout(() => this.reload(), 1000);
  }

  /** Clean up all file watchers. */
  private disposeWatchers(): void {
    for (const w of this.fileWatchers) {
      try { w.close(); } catch { /* ignore */ }
    }
    this.fileWatchers = [];
  }

  /** Get workspace root from VS Code. */
  private getWorkspaceRoot(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    return folders && folders.length > 0 ? folders[0].uri.fsPath : undefined;
  }
}
