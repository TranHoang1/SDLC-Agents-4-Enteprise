/**
 * SA4E-85 — File Hash Utility (Task 5.2).
 * Computes SHA-256 hash of file contents for concurrent modification detection.
 * Used at patch generation time and before patch application (BR-05).
 */

import * as crypto from 'crypto';
import * as vscode from 'vscode';

/**
 * Compute SHA-256 hash for a file at the given workspace path.
 * Reads file via VS Code workspace filesystem API for portability.
 * @param filePath - Workspace-relative or absolute file path
 * @returns Hex-encoded SHA-256 hash string
 * @throws Error if file cannot be read (deleted, permissions)
 */
export async function computeFileHash(filePath: string): Promise<string> {
  const uri = resolveFileUri(filePath);
  const content = await vscode.workspace.fs.readFile(uri);
  return hashBuffer(content);
}

/**
 * Compute SHA-256 hash from raw buffer content.
 * Useful when file content is already available in memory.
 * @param content - File content as Uint8Array
 * @returns Hex-encoded SHA-256 hash string
 */
export function hashBuffer(content: Uint8Array): string {
  const hash = crypto.createHash('sha256');
  hash.update(content);
  return hash.digest('hex');
}

/**
 * Compare two hash values for equality.
 * Constant-time comparison to avoid timing attacks on hash checks.
 * @param hashA - First SHA-256 hex hash
 * @param hashB - Second SHA-256 hex hash
 * @returns True if hashes match
 */
export function hashesMatch(hashA: string, hashB: string): boolean {
  if (hashA.length !== hashB.length) return false;
  const bufA = Buffer.from(hashA, 'hex');
  const bufB = Buffer.from(hashB, 'hex');
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Resolve a file path to a VS Code URI.
 * Handles both absolute paths and workspace-relative paths.
 */
function resolveFileUri(filePath: string): vscode.Uri {
  if (filePath.startsWith('/') || /^[a-zA-Z]:/.test(filePath)) {
    return vscode.Uri.file(filePath);
  }
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return vscode.Uri.file(filePath);
  }
  return vscode.Uri.joinPath(folders[0].uri, filePath);
}
