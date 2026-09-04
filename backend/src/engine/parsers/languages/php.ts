/**
 * PHP regex symbol-extraction patterns (SA4E-225).
 * All patterns are anchored with `^` and run under the forced `m` flag (ReDoS-safe).
 * The method pattern is placed before the free-function pattern so visibility-bearing
 * functions resolve to `method`.
 */

import type { PatternDef } from '../signature-extractor.js';

export const PHP_PATTERNS: PatternDef[] = [
  { regex: /^\s*(?:abstract\s+|final\s+)?class\s+(\w+)/m, kind: 'class', nameGroup: 1 },
  { regex: /^\s*interface\s+(\w+)/m, kind: 'interface', nameGroup: 1 },
  { regex: /^\s*trait\s+(\w+)/m, kind: 'trait', nameGroup: 1 },
  { regex: /^\s*namespace\s+([\w\\]+)/m, kind: 'namespace', nameGroup: 1 },
  { regex: /^\s*(?:public|private|protected)(?:\s+(?:static|final|abstract))*\s+function\s+(?:&)?(\w+)/m, kind: 'method', nameGroup: 1 },
  { regex: /^\s*(?:final\s+)?function\s+(?:&)?(\w+)/m, kind: 'function', nameGroup: 1 },
];
