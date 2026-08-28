/**
 * Scala regex symbol-extraction patterns (SA4E-225).
 * All patterns are anchored with `^` and run under the forced `m` flag (ReDoS-safe).
 */

import type { PatternDef } from '../signature-extractor.js';

export const SCALA_PATTERNS: PatternDef[] = [
  { regex: /^\s*(?:(?:case|package)\s+)?object\s+(\w+)/m, kind: 'module', nameGroup: 1 },
  { regex: /^\s*(?:sealed\s+)?trait\s+(\w+)/m, kind: 'trait', nameGroup: 1 },
  { regex: /^\s*(?:(?:case|sealed|abstract|final)\s+)?class\s+(\w+)/m, kind: 'class', nameGroup: 1 },
  { regex: /^\s*(?:implicit\s+)?def\s+(\w+)/m, kind: 'function', nameGroup: 1 },
  { regex: /^\s*(?:implicit\s+)?val\s+(\w+)/m, kind: 'constant', nameGroup: 1 },
  { regex: /^\s*(?:implicit\s+)?var\s+(\w+)/m, kind: 'variable', nameGroup: 1 },
];
