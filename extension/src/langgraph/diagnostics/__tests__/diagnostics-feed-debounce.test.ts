/**
 * DiagnosticsFeedService debounce / scope / toggle / buffer tests — SA4E-185 (D2).
 * Implements the previously-skipped STC-10, STC-11, STC-12, STC-21, STC-35 at
 * UT level (mocked vscode emitter + vi.useFakeTimers), exactly as STC §2 specifies.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as vscode from "vscode";

// Mock vscode — mirrors diagnostics-feed-service.test.ts (emitter + configurable getDiagnostics).
vi.mock("vscode", () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: "C:\\ws\\test" } }],
    asRelativePath: (uri: any) => uri.fsPath?.replace("C:\\ws\\test\\", "").replace(/\\/g, "/") || "",
    getConfiguration: vi.fn(() => ({ get: (k: string, d: boolean) => d })),
  },
  Uri: { file: (p: string) => ({ fsPath: p, scheme: "file" }) },
  window: { createOutputChannel: () => ({ appendLine: () => {} }) },
  languages: {
    onDidChangeDiagnostics: vi.fn((cb: (e: unknown) => void) => ({ dispose: () => {} })),
    getDiagnostics: vi.fn(),
  },
  DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
}));

import { DiagnosticsFeedService } from "../diagnostics-feed-service";

const WS = "C:\\ws\\test";

function createService(enabled = true): DiagnosticsFeedService {
  const svc = new DiagnosticsFeedService(WS);
  if (!enabled) svc.setEnabled(false);
  return svc;
}

/** Fire an LSP event into the MOST RECENT subscriber (the service created last). */
function fireEvent(uris: Array<{ scheme: string; fsPath: string }>): void {
  const cb = vscode.languages.onDidChangeDiagnostics.mock.calls.at(-1)![0] as (e: unknown) => void;
  cb({ uris });
}

/** A single error diagnostic that satisfies the default severity filter. */
function errorEntry(line = 0): unknown {
  return { range: { start: { line } }, severity: 0, message: "err msg", code: "E1", source: "ts" };
}

function mockDiagnostics(entries: unknown[]): void {
  (vscode.languages.getDiagnostics as any).mockReturnValue(entries);
}

function uriFor(rel: string): { scheme: string; fsPath: string } {
  return { scheme: "file", fsPath: `${WS}\\${rel.replace(/\//g, "\\")}` };
}

describe("DiagnosticsFeedService debounce (STC-10/11)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    (vscode.languages.getDiagnostics as any).mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("STC-10: 10 events in < 300ms merge into exactly ONE flush with all 10 URIs", () => {
    const svc = createService();
    for (let i = 0; i < 10; i++) svc.markTouchedFromTool("write_file", { path: `src/file${i}.ts` });
    mockDiagnostics([errorEntry()]);

    for (let i = 0; i < 10; i++) {
      fireEvent([uriFor(`src/file${i}.ts`)]);
      vi.advanceTimersByTime(50); // timer keeps resetting — no flush yet
    }

    expect((svc as any).pendingUris).toHaveLength(10);
    expect(vscode.languages.getDiagnostics).not.toHaveBeenCalled(); // no early flush

    vi.advanceTimersByTime(300); // quiet window elapses -> exactly ONE flush runs

    expect(vscode.languages.getDiagnostics).toHaveBeenCalledTimes(10); // once per URI
    const summary = svc.takePendingSummary();
    expect(summary).not.toBeNull();
    expect(summary).toContain("src/file0.ts");
    expect(summary).toContain("src/file9.ts");
    expect(svc.takePendingSummary()).toBeNull(); // read-once (BR-7)
  });

  it("STC-11: no flush before 300 ms quiet window, flush exactly at 300 ms", () => {
    const svc = createService();
    svc.markTouchedFromTool("write_file", { path: "src/a.ts" });
    mockDiagnostics([errorEntry()]);

    fireEvent([uriFor("src/a.ts")]);
    vi.advanceTimersByTime(299);
    expect(vscode.languages.getDiagnostics).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1); // 300ms total
    expect(vscode.languages.getDiagnostics).toHaveBeenCalledTimes(1);
    expect(svc.takePendingSummary()).toContain("src/a.ts");
  });
});

describe("DiagnosticsFeedService scope filter (STC-12)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    (vscode.languages.getDiagnostics as any).mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("STC-12: only file-scheme URIs inside the workspace are batched", () => {
    const svc = createService();
    svc.markTouchedFromTool("write_file", { path: "src/a.ts" });
    mockDiagnostics([errorEntry()]);

    fireEvent([
      { scheme: "file", fsPath: `${WS}\\src\\a.ts` },   // eligible
      { scheme: "file", fsPath: "C:\\ws\\b\\x.ts" },     // out-of-workspace
      { scheme: "untitled", fsPath: "Untitled-1" },      // non-file
      { scheme: "git", fsPath: "Git:/branch/file.ts" },  // non-file
    ]);

    const pending = (svc as any).pendingUris;
    expect(pending).toHaveLength(1);
    expect(pending[0].fsPath).toBe(`${WS}\\src\\a.ts`);

    vi.advanceTimersByTime(300);
    expect(vscode.languages.getDiagnostics).toHaveBeenCalledTimes(1); // eligible URI only
    expect(svc.takePendingSummary()).toContain("src/a.ts");
  });
});

describe("DiagnosticsFeedService toggle resume (STC-21)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    (vscode.languages.getDiagnostics as any).mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("STC-21: resumes immediately on the next event after enable — no reload", () => {
    const svc = createService(false); // disabled session
    svc.markTouchedFromTool("write_file", { path: "src/a.ts" });
    mockDiagnostics([errorEntry()]);

    svc.setEnabled(true); // BR-9 — resume in place
    expect(svc.isEnabled).toBe(true);

    fireEvent([uriFor("src/a.ts")]);
    vi.advanceTimersByTime(300);
    expect(svc.takePendingSummary()).toContain("src/a.ts");
  });
});

describe("DiagnosticsFeedService buffer caps (STC-35 / C-4)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    (vscode.languages.getDiagnostics as any).mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("STC-35: pendingUris overflow triggers immediate flush — buffer stays bounded", () => {
    const svc = createService();
    const cb = vscode.languages.onDidChangeDiagnostics.mock.calls.at(-1)![0] as (e: unknown) => void;
    for (let i = 0; i < 300; i++) svc.markTouchedFromTool("write_file", { path: `src/f${i}.ts` });
    mockDiagnostics([errorEntry()]);

    for (let i = 0; i < 300; i++) {
      cb({ uris: [{ scheme: "file", fsPath: `${WS}\\src\\f${i}.ts` }] });
    }

    // Overflow path flushed 256 URIs synchronously (no timer advance needed)
    expect(vscode.languages.getDiagnostics).toHaveBeenCalledTimes(256);
    expect((svc as any).pendingUris.length).toBeLessThanOrEqual(256);
    expect(svc.takePendingSummary()).not.toBeNull();
  });

  it("STC-35: touchedFiles capped at 500 with FIFO eviction", () => {
    const svc = createService();
    for (let i = 0; i < 501; i++) svc.markTouchedFromTool("write_file", { path: `src/g${i}.ts` });

    const touched = svc["touchedFiles"] as Set<string>;
    expect(touched.size).toBe(500);
    expect(touched.has("src/g500.ts")).toBe(true); // recent kept
    expect(touched.has("src/g0.ts")).toBe(false);  // oldest evicted
  });
});