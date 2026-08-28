/**
 * Built-in regex PatternDef sets for the languages that also have tree-sitter
 * grammars. Relocated here from signature-extractor.ts (SA4E-225) so the engine
 * file stays under the 200-line maintainability limit.
 */

import type { PatternDef } from '../signature-extractor.js';

export const TS_PATTERNS: PatternDef[] = [
  { regex: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/m, kind: 'function', nameGroup: 1 },
  { regex: /^(?:export\s+)?class\s+(\w+)/m, kind: 'class', nameGroup: 1 },
  { regex: /^(?:export\s+)?interface\s+(\w+)/m, kind: 'interface', nameGroup: 1 },
  { regex: /^(?:export\s+)?type\s+(\w+)/m, kind: 'type', nameGroup: 1 },
  { regex: /^(?:export\s+)?enum\s+(\w+)/m, kind: 'enum', nameGroup: 1 },
  { regex: /^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\(/m, kind: 'function', nameGroup: 1 },
];

export const KOTLIN_PATTERNS: PatternDef[] = [
  { regex: /^\s*(?:(?:public|private|internal|protected)\s+)?(?:suspend\s+)?fun\s+(\w+)/m, kind: 'function', nameGroup: 1 },
  { regex: /^\s*(?:(?:public|private|internal|protected)\s+)?(?:data\s+|sealed\s+|abstract\s+|open\s+)?class\s+(\w+)/m, kind: 'class', nameGroup: 1 },
  { regex: /^\s*(?:(?:public|private|internal|protected)\s+)?interface\s+(\w+)/m, kind: 'interface', nameGroup: 1 },
  { regex: /^\s*(?:(?:public|private|internal|protected)\s+)?object\s+(\w+)/m, kind: 'module', nameGroup: 1 },
  { regex: /^\s*(?:(?:public|private|internal|protected)\s+)?enum\s+class\s+(\w+)/m, kind: 'enum', nameGroup: 1 },
];

export const PYTHON_PATTERNS: PatternDef[] = [
  { regex: /^(?:async\s+)?def\s+(\w+)/m, kind: 'function', nameGroup: 1 },
  { regex: /^class\s+(\w+)/m, kind: 'class', nameGroup: 1 },
];

export const JAVA_PATTERNS: PatternDef[] = [
  { regex: /^\s*(?:(?:public|private|protected)\s+)?(?:static\s+)?(?:[\w<>]+(?:\s*\[\])*\s+)(\w+)\s*\(/m, kind: 'function', nameGroup: 1 },
  { regex: /^\s*(?:(?:public|private|protected)\s+)?(?:abstract\s+)?class\s+(\w+)/m, kind: 'class', nameGroup: 1 },
  { regex: /^\s*(?:(?:public|private|protected)\s+)?interface\s+(\w+)/m, kind: 'interface', nameGroup: 1 },
  { regex: /^\s*(?:(?:public|private|protected)\s+)?enum\s+(\w+)/m, kind: 'enum', nameGroup: 1 },
];

export const GO_PATTERNS: PatternDef[] = [
  { regex: /^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)/m, kind: 'function', nameGroup: 1 },
  { regex: /^type\s+(\w+)\s+struct/m, kind: 'struct', nameGroup: 1 },
  { regex: /^type\s+(\w+)\s+interface/m, kind: 'interface', nameGroup: 1 },
];

export const RUST_PATTERNS: PatternDef[] = [
  { regex: /^\s*(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/m, kind: 'function', nameGroup: 1 },
  { regex: /^\s*(?:pub\s+)?struct\s+(\w+)/m, kind: 'struct', nameGroup: 1 },
  { regex: /^\s*(?:pub\s+)?trait\s+(\w+)/m, kind: 'trait', nameGroup: 1 },
  { regex: /^\s*(?:pub\s+)?enum\s+(\w+)/m, kind: 'enum', nameGroup: 1 },
  { regex: /^\s*(?:pub\s+)?mod\s+(\w+)/m, kind: 'module', nameGroup: 1 },
];

/** Apex (Salesforce) — classes, interfaces, enums, triggers, methods. */
export const APEX_PATTERNS: PatternDef[] = [
  { regex: /^\s*(?:(?:public|private|protected|global)\s+)?(?:virtual\s+|abstract\s+|with\s+sharing\s+|without\s+sharing\s+|inherited\s+sharing\s+)*class\s+(\w+)/m, kind: 'class', nameGroup: 1 },
  { regex: /^\s*(?:(?:public|private|protected|global)\s+)?interface\s+(\w+)/m, kind: 'interface', nameGroup: 1 },
  { regex: /^\s*(?:(?:public|private|protected|global)\s+)?enum\s+(\w+)/m, kind: 'enum', nameGroup: 1 },
  { regex: /^\s*trigger\s+(\w+)\s+on\s+/m, kind: 'function', nameGroup: 1 },
  { regex: /^\s*(?:(?:public|private|protected|global)\s+)?(?:static\s+)?(?:(?:override|virtual|abstract|testMethod)\s+)*(?:[\w<>,\s[\]]+?)\s+(\w+)\s*\(/m, kind: 'method', nameGroup: 1 },
];
