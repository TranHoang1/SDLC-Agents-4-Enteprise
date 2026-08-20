/**
 * SA4E-183 — DiffOriginalProvider.
 * TextDocumentContentProvider for the `diff-original:` URI scheme.
 * Serves original file content from DiffTracker's in-memory store
 * so VS Code diff editor can show before/after comparison.
 *
 * Security: Only returns content already captured by DiffTracker —
 * no arbitrary filesystem access through this provider.
 */

import * as vscode from 'vscode';
import type { IDiffTracker } from './IDiffTracker';

/**
 * Virtual document provider for original file content.
 * Registered as scheme 'diff-original' in extension activation.
 */
export class DiffOriginalProvider implements vscode.TextDocumentContentProvider {
  private readonly diffTracker: IDiffTracker;

  constructor(diffTracker: IDiffTracker) {
    this.diffTracker = diffTracker;
  }

  /**
   * Provide the original text content for a virtual document URI.
   * URI path contains the workspace-relative file path.
   * @param uri - diff-original:{filePath} URI
   * @returns Original file content or empty string if not tracked
   */
  provideTextDocumentContent(uri: vscode.Uri): string {
    // Normalize: remove leading slash on Windows paths
    const filePath = uri.path.startsWith('/') ? uri.path.slice(1) : uri.path;
    return this.diffTracker.getOriginalContent(filePath) ?? '';
  }
}
