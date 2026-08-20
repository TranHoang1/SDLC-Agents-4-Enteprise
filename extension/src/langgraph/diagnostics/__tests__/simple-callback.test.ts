/**
 * Simple test to verify the mock works
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as vscode from "vscode";

vi.mock("vscode", () => ({
  workspace: { 
    workspaceFolders: [{ uri: { fsPath: "C:\\ws\\test" } }],
    getConfiguration: vi.fn(() => ({ get: (k: string, d: boolean) => d })),
  },
  Uri: { file: (p: string) => ({ fsPath: p, scheme: "file" }) },
  window: { createOutputChannel: () => ({ appendLine: () => {} }) },
  languages: {
    onDidChangeDiagnostics: vi.fn((cb) => ({ dispose: () => {} })),
    getDiagnostics: vi.fn(),
  },
  DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
}));

import { DiagnosticsFeedService } from "../diagnostics-feed-service";

describe("Simple callback test", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should call getDiagnostics when callback fires", () => {
    const svc = new DiagnosticsFeedService("C:\\ws\\test");
    svc.start();
    
    const callback = vscode.languages.onDidChangeDiagnostics.mock.calls[0][0];
    callback([{ scheme: "file", fsPath: "C:\\ws\\test\\src\\a.ts" }]);
    
    vi.advanceTimersByTime(300);
    
    expect(vscode.languages.getDiagnostics).toHaveBeenCalledTimes(1);
  });
});