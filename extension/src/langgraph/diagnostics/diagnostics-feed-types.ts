/**
 * Diagnostics Feed Types — SA4E-185
 * Type definitions for the LSP Diagnostics Feed service.
 */

import * as vscode from "vscode";

/** One diagnostic that reached the flush stage (FSD §3.1.4 intermediate data). */
export interface DiagnosticsBatchEntry {
  file: string;                       // workspace-relative path (BR-3/BR-6)
  line: number;                       // 1-based; clamped to file line count
  severity: "error" | "warning" | "info" | "hint";  // mapped from DiagnosticSeverity (BR-6)
  message: string;                    // non-empty diagnostic message
  code: string;                       // empty string when absent (e.g. TS2339)
  source: string;                     // provider name (e.g. "typescript"); optional
}

export interface DiagnosticsFeedConfig {
  debounceMs: number;                 // 300 (BR-2, fixed in v1)
  perFileCap: number;                 // 20  (§3.2 Validation Rules, N)
  totalCap: number;                   // 50  (§3.2 Validation Rules, M)
  severityFilter: ("error" | "warning" | "info" | "hint")[];  // default ["error","warning"]
  tokenBudgetChars: number;           // ≈8000 (≈2000 tokens, V13)
}

export interface FeedSummary {
  header: string;                     // "[Diagnostics feed] (toggle: ...)"
  body: string;                       // one line per entry (BR-6)
  suppressed: number;                 // count dropped by caps
}

export const DEFAULT_CONFIG: DiagnosticsFeedConfig = {
  debounceMs: 300,            // BR-2  (fixed in v1; configurability deferred)
  perFileCap: 20,             // §3.2  N
  totalCap: 50,               // §3.2  M
  severityFilter: ["error", "warning"],   // §3.2 default filter
  tokenBudgetChars: 8000,     // ≈ ~2000 tokens  (§3.2 / V13)
};

/** Maps VS Code DiagnosticSeverity to our severity enum (BR-6). */
export function mapSeverity(severity: vscode.DiagnosticSeverity): "error" | "warning" | "info" | "hint" {
  switch (severity) {
    case vscode.DiagnosticSeverity.Error:
      return "error";
    case vscode.DiagnosticSeverity.Warning:
      return "warning";
    case vscode.DiagnosticSeverity.Information:
      return "info";
    case vscode.DiagnosticSeverity.Hint:
      return "hint";
    default:
      return "info";
  }
}