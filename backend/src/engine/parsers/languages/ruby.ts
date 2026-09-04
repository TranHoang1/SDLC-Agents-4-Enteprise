/**
 * Ruby regex symbol-extraction patterns (SA4E-225).
 * All patterns are anchored with `^` and run under the forced `m` flag (ReDoS-safe).
 * @ivar / $gvar assignments are captured with their sigil; attr_accessor-like
 * declarations are captured as variables.
 */

import type { PatternDef } from '../signature-extractor.js';

export const RUBY_PATTERNS: PatternDef[] = [
  { regex: /^\s*class\s+(\w+)/m, kind: 'class', nameGroup: 1 },
  { regex: /^\s*module\s+(\w+)/m, kind: 'module', nameGroup: 1 },
  { regex: /^\s*def\s+(?:self\.)?(\w+)/m, kind: 'function', nameGroup: 1 },
  { regex: /^\s*([A-Z][A-Z0-9_]+)\s*=/m, kind: 'constant', nameGroup: 1 },
  { regex: /^\s*((?:@|\$)\w+)\s*=/m, kind: 'variable', nameGroup: 1 },
  { regex: /^\s*attr_(?:accessor|reader|writer)\s+:(\w+)/m, kind: 'variable', nameGroup: 1 },
];
