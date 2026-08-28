/**
 * PowerShell regex symbol-extraction patterns (SA4E-225).
 * All patterns are anchored with `^` and run under the forced `m` flag (ReDoS-safe).
 *
 * The `param(...)` pattern is intentionally NOT anchored at line start because real
 * PowerShell places `param(...)` after `function Name {` on the same line. It uses a
 * lazy negated class `[^)]*?` (linear, no nested quantifiers) so it remains ReDoS-safe.
 *
 * Per the approved deviation, PowerShell yields >= 4 distinct kinds (not >=5).
 */

import type { PatternDef } from '../signature-extractor.js';

export const POWERSHELL_PATTERNS: PatternDef[] = [
  // Verb-Noun PascalCase heuristic enforces the approved-verb convention and cuts noise.
  { regex: /^\s*function\s+([A-Z]\w+-[A-Z]\w+)/m, kind: 'function', nameGroup: 1 },
  { regex: /^\s*class\s+(\w+)/m, kind: 'class', nameGroup: 1 },
  { regex: /^\s*\$(\w+)\s*=/m, kind: 'variable', nameGroup: 1 },
  // Non-anchored but linear/lazy: captures $Param inside param(...) blocks.
  { regex: /param\s*\([^)]*?\$(\w+)/m, kind: 'variable', nameGroup: 1 },
  { regex: /^\s*Set-Variable\s+-Name\s+(\w+)\s+-Option\s+Constant/m, kind: 'constant', nameGroup: 1 },
];
