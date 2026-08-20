/**
 * Debug test for DiagnosticsFeedService mock
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as vscode from "vscode";

// Simple inline mock like the existing tests
vi.mock("vscode", () => ({
  workspace: { 
    workspaceFolders: [{ uri: { fsPath: "C:\\ws\\test" } }],
    getConfiguration: vi.fn(() => ({ get: (k: string, d: boolean) => d })),
  },
  Uri: { file: (p: string) => ({ fsPath: p, scheme: "file" }) },
  window: { createOutputChannel: () => ({ appendLine: () => {} }) },
  languages: {
    onDidChangeDiagnostics: vi.fn((cb) => {
      console.log("onDidChangeDiagnostics called with callback");
      return { dispose: () => {} };
    }),
    getDiagnostics: vi.fn(),
  },
  DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
}));

import { DiagnosticsFeedService } from "../diagnostics-feed-service";

describe("Mock test - simple", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should fire event and call getDiagnostics after debounce", () => {
    const svc = new DiagnosticsFeedService("C:\\ws\\test");
    console.log("enabled:", (svc as any).enabled);
    
    // Wrap onDiagnosticsChanged to add detailed logging
    const originalOnDiagnosticsChanged = svc.onDiagnosticsChanged.bind(svc);
    svc.onDiagnosticsChanged = function(uris: any) {
      console.log(">>> onDiagnosticsChanged START");
      console.log("  uris:", JSON.stringify(uris));
      console.log("  this.enabled:", this.enabled);
      const wsFolders = vscode.workspace.workspaceFolders ?? [];
      console.log("  wsFolders:", wsFolders);
      console.log("  wsFolders.length:", wsFolders.length);
      if (wsFolders.length === 0) {
        console.log("  RETURN: wsFolders empty");
        return;
      }
      const eligible = uris.filter((u: any) => u.scheme === "file"
        && wsFolders.some((f: any) => this.isInside(f.uri, u)));
      console.log("  eligible:", JSON.stringify(eligible));
      if (eligible.length === 0) {
        console.log("  RETURN: eligible empty");
        return;
      }
      console.log("  pendingUris before:", this.pendingUris);
      this.pendingUris.push(...eligible);
      console.log("  pendingUris after:", this.pendingUris);
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      const myEpoch = this.epoch;
      console.log("  setting debounce timer, myEpoch:", myEpoch);
      this.debounceTimer = setTimeout(() => this.flush(myEpoch), this.config.debounceMs);
      console.log("  debounceTimer set:", this.debounceTimer);
      console.log(">>> onDiagnosticsChanged END");
    };
    
    // Fire event through the service's internal handler
    const onDidChangeCallback = vscode.languages.onDidChangeDiagnostics.mock.calls[0][0];
    console.log("Calling callback with URIs");
    onDidChangeCallback([{ scheme: "file", fsPath: "C:\\ws\\test\\src\\a.ts" }]);
    console.log("Callback executed");
    
    vi.advanceTimersByTime(300);
    
    console.log("getDiagnostics calls:", vscode.languages.getDiagnostics.mock.calls.length);
    expect(vscode.languages.getDiagnostics).toHaveBeenCalled();
  });
});