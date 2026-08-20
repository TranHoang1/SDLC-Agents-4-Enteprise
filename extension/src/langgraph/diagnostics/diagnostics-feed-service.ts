/**
 * DiagnosticsFeedService — SA4E-185
 * LSP Diagnostics Feed: subscribe → debounce(300ms) → filter touched files → summarize → buffer.
 * Implements UC-01, UC-02, UC-03 — BR-1 … BR-10.
 */

import * as vscode from "vscode";
import { classifyTool, extractFilePath } from "../hooks/hook-tool-matcher";
import { debugLog, debugError } from "../../debug-logger";
import type {
  DiagnosticsBatchEntry,
  DiagnosticsFeedConfig,
} from "./diagnostics-feed-types";
import { mapSeverity, DEFAULT_CONFIG } from "./diagnostics-feed-types";

/** Maximum pending URIs before forced flush (C-4 / F-05). */
const MAX_PENDING_URIS = 256;
/** Maximum touched files tracked per session (C-7 / F-07). */
const MAX_TOUCHED_FILES = 500;

/** Secret patterns to redact in summary output (C-5 / F-04). */
const SECRET_PATTERNS: RegExp[] = [
  /sk-[a-zA-Z0-9]{20,}/g,                                    // OpenAI/Anthropic API keys
  /AKIA[0-9A-Z]{16}/g,                                       // AWS access keys
  /-----BEGIN [A-Z ]+PRIVATE KEY-----/g,                     // PEM private keys
  /password\s*[=:]\s*\S+/gi,                                 // password=...
  /token\s*[=:]\s*\S+/gi,                                    // token=...
  /secret\s*[=:]\s*\S+/gi,                                   // secret=...
  /apikey\s*[=:]\s*\S+/gi,                                   // apikey=...
];

/** Directive tokens to neutralize in messages (C-1 / F-01). */
const DIRECTIVE_TOKENS = [
  "ignore all previous instructions",
  "ignore previous instructions",
  "disregard",
  "disregard all",
  "you are now",
  "system prompt",
  "forget everything",
  "new instructions",
  "override",
  "bypass",
  "execute code",
  "run shell",
  "delete all",
  "rm -rf",
];

export class DiagnosticsFeedService implements vscode.Disposable {
  private enabled = true;                          // BR-8 — sync'd from kiroSdlc.enableDiagnosticsFeed
  private subscription: vscode.Disposable | null = null;
  private pendingUris: vscode.Uri[] = [];          // BR-2
  private debounceTimer: NodeJS.Timeout | null = null; // BR-2
  private touchedFiles = new Set<string>();        // BR-4/5 — session-scoped
  private pendingSummary: string | null = null;    // BR-7 — read-once
  private epoch = 0;                               // race guard (§10.5 RC-1/RC-5)
  private readonly config = DEFAULT_CONFIG;
  private readonly workspaceRoot: string;
  private readonly getConfig: () => vscode.WorkspaceConfiguration;
  private readonly disposables: vscode.Disposable[] = [];

  /**
   * @param workspaceRoot Absolute path to workspace root
   * @param getConfig Injectable config getter for tests/headless; default = vscode.workspace.getConfiguration("kiroSdlc")
   */
  constructor(
    workspaceRoot: string,
    getConfig?: () => vscode.WorkspaceConfiguration
  ) {
    this.workspaceRoot = workspaceRoot;
    this.getConfig = getConfig ?? (() => vscode.workspace.getConfiguration("kiroSdlc"));

    // Headless-safe read: failure → treated as disabled (EF-01)
    try {
      this.enabled = this.getConfig().get<boolean>("enableDiagnosticsFeed", true);
    } catch {
      debugLog("[DD-FEED] [WARN] settings read failed — treated as disabled");
      this.enabled = false; // E-12
    }

    this.start();
  }

  /** BR-1: Subscribe to onDidChangeDiagnostics; returns subscription for context.subscriptions. */
  start(): vscode.Disposable {
    if (this.subscription) return this.subscription;

    const sub = vscode.languages.onDidChangeDiagnostics((uris) => {
      try {
        this.onDiagnosticsChanged(uris);
      } catch (err) {
        debugError("[DD-FEED] handler", err as Error); // E-1: non-fatal
      }
    });

    this.subscription = sub;
    this.disposables.push(sub);
    debugLog(`[DD-FEED] start enabled=${this.enabled} epoch=${this.epoch}`);
    return sub;
  }

  /** BR-1/10: Unsubscribe + clear timer/buffer. */
  stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.subscription) {
      try {
        this.subscription.dispose();
      } catch (err) {
        debugError("[DD-FEED] dispose subscription", err as Error); // E-13
      }
      this.subscription = null;
    }
    this.pendingUris = [];
    this.pendingSummary = null;
    debugLog(`[DD-FEED] stop epoch=${this.epoch}`);
  }

  /** UC-01 EF-03: Detach subscription, clear state. */
  dispose(): void {
    this.stop();
    for (const d of this.disposables) {
      try { d.dispose(); } catch { /* ignore */ }
    }
    this.disposables.length = 0;
    this.touchedFiles.clear();
    this.epoch++;
  }

  /** BR-2/3: Handler registered via onDidChangeDiagnostics. */
  onDiagnosticsChanged(event: vscode.DiagnosticChangeEvent): void {
    const uris = event.uris;
    if (!this.enabled) return;                              // BR-10: inert
    const wsFolders = vscode.workspace.workspaceFolders ?? [];
    if (wsFolders.length === 0) return;                     // no workspace → skip

    const eligible = uris.filter((u) => u.scheme === "file"
      && wsFolders.some((f) => this.isInside(f.uri, u)));   // BR-3

    if (eligible.length === 0) return;

    // C-4 / F-05: bound pendingUris
    if (this.pendingUris.length + eligible.length > MAX_PENDING_URIS) {
      debugLog("[DD-FEED] overflow pendingUris — flushing immediately");
      this.flush(this.epoch);
    }
    this.pendingUris.push(...eligible);

    if (this.debounceTimer) clearTimeout(this.debounceTimer); // BR-2 reset
    const myEpoch = this.epoch;
    this.debounceTimer = setTimeout(() => this.flush(myEpoch), this.config.debounceMs);

    debugLog(`[DD-FEED] onDidChange uris=${uris.length} eligible=${eligible.length} pending=${this.pendingUris.length}`);
  }

  /** BR-2/6: Quiet-window flush — getDiagnostics → filter → buildSummary. */
  flush(myEpoch: number): void {
    if (myEpoch !== this.epoch) {
      debugLog("[DD-FEED] stale flush dropped (epoch)");
      return; // RC-1: abort stale callback
    }
    if (!this.enabled) {
      this.clearUris();
      return; // BR-10 / EF-02: last-state-wins
    }

    const uris = this.pendingUris;
    this.pendingUris = [];

    if (uris.length === 0) return;

    const raw: DiagnosticsBatchEntry[] = [];
    for (const uri of uris) {
      try {
        const diags = vscode.languages.getDiagnostics(uri);
        for (const d of diags) {
          raw.push({
            file: vscode.workspace.asRelativePath(uri),
            line: d.range.start.line + 1, // 1-based
            severity: mapSeverity(d.severity),
            message: d.message,
            code: String(d.code ?? ""),
            source: d.source ?? "",
          });
        }
      } catch (e) {
        debugLog(`[DD-FEED] [WARN] getDiagnostics failed: ${uri} — ${(e as Error).message}`); // E-2
      }
    }

    const kept = this.filter(raw);
    if (kept.length === 0) {
      debugLog("[DD-FEED] filtered to 0 entries");
      return; // AF-01: nothing injected
    }

    this.pendingSummary = this.buildSummary(kept);
    debugLog(`[DD-FEED] flush uris=${uris.length} entries=${raw.length} kept=${kept.length} truncated=${raw.length - kept.length}`);
  }

  /** BR-4/6: Filter to touched files + severity + dedupe + line clamp. */
  filter(entries: DiagnosticsBatchEntry[]): DiagnosticsBatchEntry[] {
    return entries
      .filter((e) => this.touchedFiles.has(e.file))                          // BR-4: touched only
      .filter((e) => this.config.severityFilter.includes(e.severity))        // §3.2 default filter
      .filter((e, i, arr) => arr.findIndex(
        (x) => x.file === e.file && x.line === e.line && x.code === e.code
      ) === i)                                                               // dedupe (file,line,code)
      .map((e) => ({ ...e, line: Math.min(e.line, this.lineCountSafe(e.file) ?? e.line) })); // clamp line
  }

  /** BR-6: Build summary with caps 20/file, 50 total + ≤8000 chars guard. */
  buildSummary(kept: DiagnosticsBatchEntry[]): string {
    const perFile = new Map<string, number>();
    const capped: string[] = [];
    let dropped = 0;

    for (const e of kept) {
      const n = perFile.get(e.file) ?? 0;
      if (n >= this.config.perFileCap || capped.length >= this.config.totalCap) {
        dropped++;
        continue;
      }
      perFile.set(e.file, n + 1);
      const line = `${e.file}:${e.line} ${e.severity} ${e.code || ""} ${e.message}`.trimEnd();
      capped.push(this.sanitizeLine(line));
    }

    const header = `[Diagnostics feed] (toggle: kiroSdlc.enableDiagnosticsFeed = ${this.enabled ? "on" : "off"})`;
    const body = capped.join("\n") + (dropped > 0 ? `\n... (${dropped} more diagnostics suppressed)` : "");
    const summary = (header + "\n" + body).slice(0, this.config.tokenBudgetChars); // V13
    return summary;
  }

  /** BR-7: Read-once at source — returns and clears buffer. */
  takePendingSummary(): string | null {
    const s = this.pendingSummary;
    this.pendingSummary = null;
    if (s) debugLog("[DD-FEED] take pending=1");
    return s;
  }

  /** BR-5: Populate touched-files set from write tool execution (handles write_file — OI-1). */
  markTouchedFromTool(toolName: string, args: Record<string, unknown>): void {
    // Layer B: allowlist fallback (defense-in-depth for OI-1)
    const isWrite = WRITE_TOOL_NAMES.has(toolName) || classifyTool(toolName) === "write";
    if (!isWrite) return; // E-10: non-write tool → skip

    const filePath = extractFilePath(toolName, args);
    if (!filePath) return; // E-10: extraction failure → skip

    const rel = this.toWorkspaceRelative(filePath);
    if (rel) {
      // C-7 / F-07: bound touchedFiles
      if (this.touchedFiles.size >= MAX_TOUCHED_FILES) {
        const first = this.touchedFiles.values().next().value;
        if (first) this.touchedFiles.delete(first);
      }
      this.touchedFiles.add(rel);
      debugLog(`[DD-FEED] markTouched tool=${toolName} file=${rel}`);
    }
  }

  /** BR-8/9/10: Live toggle — epoch++ + discard on false. */
  setEnabled(value: boolean): void {
    this.enabled = value;
    if (!value) {
      this.epoch++;
      this.clearUris();
      this.pendingSummary = null;
    }
    debugLog(`[DD-FEED] enabled=${value} epoch=${this.epoch}`);
  }

  /** BR-5: Session start — reset touchedFiles/pending/epoch. */
  clearSession(): void {
    this.touchedFiles.clear();
    this.pendingUris = [];
    this.pendingSummary = null;
    this.epoch++;
    debugLog(`[DD-FEED] clearSession epoch=${this.epoch}`);
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  // ----- Private helpers -----

  private clearUris(): void {
    this.pendingUris = [];
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /** Workspace containment check (BR-3). */
  private isInside(folder: vscode.Uri, target: vscode.Uri): boolean {
    const folderPath = folder.fsPath.replace(/\\/g, "/");
    const targetPath = target.fsPath.replace(/\\/g, "/");
    return targetPath.startsWith(folderPath + "/") || targetPath === folderPath;
  }

  /**
   * C-3 / F-03: Convert absolute path to workspace-relative, rejecting traversal/escape.
   * Returns null for out-of-workspace, absolute-outside, UNC, or traversal paths.
   */
  toWorkspaceRelative(absPath: string): string | null {
    if (!absPath) return null;

    // Normalize: handle file:// URIs, drive letters, backslashes
    let path = absPath;
    if (path.startsWith("file://")) {
      try {
        path = new URL(path).pathname;
        // Windows: /C:/path → C:/path
        if (process.platform === "win32" && path.startsWith("/") && path[2] === ":") {
          path = path.slice(1);
        }
      } catch {
        return null;
      }
    }
    path = path.replace(/\\/g, "/");

    const wsRoot = this.workspaceRoot.replace(/\\/g, "/");
    const wsRootNorm = wsRoot.endsWith("/") ? wsRoot : wsRoot + "/";

    // Reject absolute paths outside workspace
    if (path.startsWith("/") || /^[A-Za-z]:/.test(path)) {
      if (!path.startsWith(wsRootNorm)) return null; // C-3: escape
      const rel = path.slice(wsRootNorm.length);
      // Reject traversal segments inside workspace prefix (e.g. C:/ws/test/../../etc/passwd)
      if (rel.split("/").includes("..")) return null; // C-3: escape via .. inside root
      return rel;
    }

    // Reject relative traversal (../ etc.)
    if (path.startsWith("..") || path.includes("/..")) return null;

    // Already relative and inside workspace
    return path;
  }

  /** Get file line count for clamping (returns undefined if unknown). */
  private lineCountSafe(file: string): number | undefined {
    try {
      const uri = vscode.Uri.file(this.workspaceRoot + "/" + file);
      const doc = require("vscode").workspace.textDocuments.find((d: any) => d.uri.fsPath === uri.fsPath);
      if (doc) return doc.lineCount;
    } catch { /* ignore */ }
    return undefined;
  }

  /** C-1 / F-01: Sanitize a single summary line — control chars, directives, secrets. */
  private sanitizeLine(line: string): string {
    // 1. Control chars → space, collapse whitespace
    let s = line.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();

    // 2. Neutralize directive tokens (wrap in [...])
    for (const token of DIRECTIVE_TOKENS) {
      const regex = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
      s = s.replace(regex, `[${token}]`);
    }

    // 3. Redact secret patterns (C-5 / F-04)
    for (const pattern of SECRET_PATTERNS) {
      s = s.replace(pattern, "[REDACTED]");
    }

    return s;
  }

  /** C-1 / F-01: Sanitize message text — exported for unit testing. */
  sanitizeMessage(message: string): string {
    if (!message) return "";
    let s = message.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
    for (const token of DIRECTIVE_TOKENS) {
      const regex = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
      s = s.replace(regex, `[${token}]`);
    }
    for (const pattern of SECRET_PATTERNS) {
      s = s.replace(pattern, "[REDACTED]");
    }
    return s;
  }
}

/** Write tool allowlist (DR-1 Layer B — OI-1 fix). */
const WRITE_TOOL_NAMES = new Set([
  "write_file",
  "fs_write",
  "str_replace",
  "fs_append",
  "delete_file",
  "stream_write_file",
]);