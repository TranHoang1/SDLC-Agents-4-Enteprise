/**
 * SA4E-223 F-01 — Symlink containment guard for the workspace scanner.
 *
 * The shared `isWithinRoot` (shared/path-safety.ts) only does `path.resolve`,
 * which does NOT dereference symlinks. A symlink *inside* the workspace that
 * points *outside* it would therefore pass a string-based containment check yet
 * be read via `fs.readFileSync`/`statSync` following the link. We canonicalize
 * with `fs.realpathSync` so the real target is what we verify against.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Returns true when the already-canonicalized `realPath` lies inside the
 * already-canonicalized `root` (or equals it). Callers must pass real paths.
 */
export function isWithinWorkspace(realPath: string, root: string): boolean {
  return realPath === root || realPath.startsWith(root + path.sep);
}

/** Resolve the canonical workspace root, falling back to a string resolve. */
export function resolveWorkspaceRoot(workspace: string): string {
  try {
    return fs.realpathSync(workspace);
  } catch {
    return path.resolve(workspace);
  }
}

/**
 * Resolve `filePath` to its canonical real path and return it only when the
 * real path lies inside `workspace`. Returns null on escape OR any fs error
 * (broken link, missing file) so callers can safely skip the entry.
 */
export function resolveContainedPath(filePath: string, workspace: string): string | null {
  try {
    const realPath = fs.realpathSync(filePath);
    const root = resolveWorkspaceRoot(workspace);
    if (isWithinWorkspace(realPath, root)) return realPath;
    return null;
  } catch {
    return null;
  }
}
