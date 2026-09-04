/**
 * Bash regex symbol-extraction patterns (SA4E-225).
 * All patterns are anchored with `^` and run under the forced `m` flag (ReDoS-safe).
 * The `name()` form excludes control keywords via a linear negative lookahead.
 * Per the approved deviation, Bash yields >= 3 distinct kinds (not >=5).
 */

import type { PatternDef } from '../signature-extractor.js';

export const BASH_PATTERNS: PatternDef[] = [
  { regex: /^\s*function\s+(\w+)/m, kind: 'function', nameGroup: 1 },
  { regex: /^\s*(?!if|for|while|case|elif|then|else|do|until|select|time|function)(\w[\w-]*)\s*\(\s*\)\s*\{?/m, kind: 'function', nameGroup: 1 },
  { regex: /^\s*(?:export\s+)?(?:local\s+)?(\w+)=/m, kind: 'variable', nameGroup: 1 },
  { regex: /^\s*readonly\s+(\w+)=/m, kind: 'constant', nameGroup: 1 },
];
