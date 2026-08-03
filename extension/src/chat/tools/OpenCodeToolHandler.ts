/**
 * SA4E-85 — OpenCodeToolHandler (Tasks 5.3, 5.4, 5.6).
 * Implements IToolHandler with Template Method pattern:
 *   applyDiff → checkHash → compare → apply/block.
 * Uses WorkspaceEdit for undo/redo support (BR-23).
 * Detects concurrent modifications via SHA-256 comparison (BR-05, BR-07).
 */

import * as vscode from 'vscode';
import { computeFileHash, hashesMatch } from './fileHasher';
import type {
  ApplyResult,
  DiffBlock,
  IToolHandler,
} from './diffTypes';

/**
 * Callback to request a fresh patch from the LLM after conflict.
 * Injected via constructor to decouple from specific LLM implementation.
 */
export type RegeneratePatchFn =
  (diffId: string, filePath: string) => Promise<DiffBlock>;

/**
 * OpenCodeToolHandler — applies diffs with conflict detection.
 * Template Method: applyDiff checks hash → compare → apply or block.
 * @implements IToolHandler
 */
export class OpenCodeToolHandler implements IToolHandler {
  private readonly regenerateFn: RegeneratePatchFn;

  /**
   * @param regenerateFn - Injected function to regenerate patches (DIP)
   */
  constructor(regenerateFn: RegeneratePatchFn) {
    this.regenerateFn = regenerateFn;
  }

  /**
   * Apply a diff block using WorkspaceEdit (preserves Ctrl+Z).
   * Template Method: hash check → compare → apply or block.
   * @param diff - The DiffBlock to apply
   * @returns ApplyResult indicating success or error category
   */
  async applyDiff(diff: DiffBlock): Promise<ApplyResult> {
    const fileExists = await this.checkFileExists(diff.filePath);
    if (!fileExists) {
      return { success: false, error: 'FILE_DELETED' };
    }

    const currentHash = await this.computeFileHash(diff.filePath);
    const hashMatch = hashesMatch(
      diff.fileHashAtGeneration,
      currentHash
    );

    if (!hashMatch) {
      return { success: false, error: 'CONFLICT' };
    }

    return this.executeWorkspaceEdit(diff);
  }

  /** Mark diff as rejected — no-op on file system */
  rejectDiff(_diffId: string): void {
    // Status update handled by the caller (webview store)
  }

  /**
   * Request fresh patch generation after a conflict.
   * Delegates to injected regenerate function (DIP).
   * @param diffId - Original conflicted diff ID
   * @param filePath - File path to regenerate patch for
   * @returns New DiffBlock with updated hash and content
   */
  async regeneratePatch(
    diffId: string,
    filePath: string
  ): Promise<DiffBlock> {
    return this.regenerateFn(diffId, filePath);
  }

  /**
   * Compute SHA-256 hash for a file. Delegates to fileHasher module.
   * @param filePath - File to hash
   * @returns Hex SHA-256 string
   */
  async computeFileHash(filePath: string): Promise<string> {
    return computeFileHash(filePath);
  }

  /** Run a command in a VS Code terminal */
  runTerminalCommand(command: string, terminalName: string): void {
    const terminal = vscode.window.createTerminal(terminalName);
    terminal.show(true);
    terminal.sendText(command);
  }

  /**
   * Apply the patch content via WorkspaceEdit (BR-23).
   * Replaces full document range to ensure undo/redo works correctly.
   */
  private async executeWorkspaceEdit(
    diff: DiffBlock
  ): Promise<ApplyResult> {
    try {
      const uri = this.resolveUri(diff.filePath);
      const doc = await vscode.workspace.openTextDocument(uri);
      const fullRange = new vscode.Range(
        doc.positionAt(0),
        doc.positionAt(doc.getText().length)
      );

      const edit = new vscode.WorkspaceEdit();
      edit.replace(uri, fullRange, diff.patch);
      const applied = await vscode.workspace.applyEdit(edit);

      return applied
        ? { success: true }
        : { success: false, error: 'EDIT_FAILED' };
    } catch {
      return { success: false, error: 'EDIT_FAILED' };
    }
  }

  /** Check if the target file still exists on disk */
  private async checkFileExists(filePath: string): Promise<boolean> {
    try {
      const uri = this.resolveUri(filePath);
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }

  /** Resolve file path to VS Code URI */
  private resolveUri(filePath: string): vscode.Uri {
    if (filePath.startsWith('/') || /^[a-zA-Z]:/.test(filePath)) {
      return vscode.Uri.file(filePath);
    }
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return vscode.Uri.file(filePath);
    }
    return vscode.Uri.joinPath(folders[0].uri, filePath);
  }
}
