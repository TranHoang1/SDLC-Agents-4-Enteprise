/**
 * SA4E-6 — Mount security (BR-08 sensitive-file exclusion).
 *
 * Docker bind mounts cannot exclude individual files natively, so we stage a
 * copy of the mount source with excluded patterns removed and bind THAT temp
 * directory. `matchExcludePattern` is the pure, unit-tested matcher; `prepareSafeMount`
 * performs the copy. Both are framework-agnostic (work on any host path).
 */

import * as fs from 'fs';
import * as path from 'path';

/** Convert a glob-ish exclude pattern into a matcher against a relative path. */
export function matchExcludePattern(relPath: string, pattern: string): boolean {
  const norm = relPath.replace(/\\/g, '/');
  // Directory prefix (e.g. ".ssh/") — matches the dir itself or anything beneath it.
  if (pattern.endsWith('/')) {
    const dir = pattern.slice(0, -1);
    return norm === dir || norm.startsWith(dir + '/');
  }
  // Wildcard patterns (e.g. "*.pem", ".env.*") — match basename OR full path.
  if (pattern.includes('*')) {
    const re = patternToRegex(pattern);
    return re.test(norm) || re.test(path.basename(norm));
  }
  // Exact: matches full relative path or the basename (e.g. ".env", ".git/credentials").
  return norm === pattern || path.basename(norm) === pattern;
}

function patternToRegex(pattern: string): RegExp {
  let s = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  s = s.replace(/\*/g, '.*');
  return new RegExp('^' + s + '$');
}

/** True when any entry (file or directory) under `source` matches an exclude pattern. */
export function shouldExclude(relPath: string, patterns: string[]): boolean {
  return patterns.some((p) => matchExcludePattern(relPath, p));
}

/**
 * Copy `source` into `dest`, recursively, skipping any path that matches the
 * exclude patterns. Returns `dest`. Throws MountError if source is missing.
 */
export function prepareSafeMount(source: string, patterns: string[], dest: string): string {
  if (!fs.existsSync(source)) {
    throw new Error(`Mount source does not exist: ${source}`);
  }
  fs.mkdirSync(dest, { recursive: true });
  copyTree(source, dest, patterns);
  return dest;
}

function copyTree(srcDir: string, destDir: string, patterns: string[]): void {
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const rel = entry.name;
    if (shouldExclude(rel, patterns)) continue;
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyTree(srcPath, destPath, patterns);
    } else if (entry.isFile()) {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
