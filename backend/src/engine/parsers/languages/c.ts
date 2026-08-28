/**
 * C regex symbol-extraction patterns (SA4E-225).
 * All patterns are anchored with `^` and run under the forced `m` flag (ReDoS-safe).
 */

import type { PatternDef } from '../signature-extractor.js';

export const C_PATTERNS: PatternDef[] = [
  { regex: /^\s*struct\s+(\w+)/m, kind: 'struct', nameGroup: 1 },
  { regex: /^\s*enum\s+(\w+)/m, kind: 'enum', nameGroup: 1 },
  { regex: /^\s*typedef\s+(?:\w+\s+)+(\w+)\s*;/m, kind: 'type', nameGroup: 1 },
  { regex: /^#define\s+(\w+)\s*\(/m, kind: 'function', nameGroup: 1 },
  { regex: /^#define\s+(\w+)\s+\S+/m, kind: 'constant', nameGroup: 1 },
  { regex: /^\s*(?:static\s+)?(?:const\s+)?(?:unsigned\s+|signed\s+)?(?:long\s+|short\s+)*\w+\s+(\w+)\s*(?:\[[^\]]*\])?\s*=/m, kind: 'variable', nameGroup: 1 },
];
