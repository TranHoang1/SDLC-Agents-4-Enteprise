/**
 * C# regex symbol-extraction patterns (SA4E-225).
 * All patterns are anchored with `^` and run under the forced `m` flag (ReDoS-safe).
 * An optional `[Attribute]` prefix and modifier group are prepended; the free-function
 * / method pattern excludes control keywords via a linear negative lookahead.
 * Order matters: specific declarations precede the generic property pattern so the
 * correct kind wins.
 */

import type { PatternDef } from '../signature-extractor.js';

const CS_PREFIX = '(?:\[[\\w\\.]+\]\\s*)*(?:(?:public|private|protected|internal|abstract|sealed|static|partial|async)\\s+)*';

export const CSHARP_PATTERNS: PatternDef[] = [
  { regex: new RegExp(`^${CS_PREFIX}(?:record|class)\\s+(\\w+)`, 'm'), kind: 'class', nameGroup: 1 },
  { regex: new RegExp(`^${CS_PREFIX}interface\\s+(\\w+)`, 'm'), kind: 'interface', nameGroup: 1 },
  { regex: new RegExp(`^${CS_PREFIX}struct\\s+(\\w+)`, 'm'), kind: 'struct', nameGroup: 1 },
  { regex: new RegExp(`^${CS_PREFIX}enum\\s+(\\w+)`, 'm'), kind: 'enum', nameGroup: 1 },
  { regex: new RegExp(`^${CS_PREFIX}delegate\\s+[\\w<>\\[\\],\\s\\.\\?]+\\s+(\\w+)\\s*\\(`, 'm'), kind: 'type', nameGroup: 1 },
  { regex: new RegExp(`^${CS_PREFIX}(?!if|for|while|foreach|switch|return|catch|using|lock|do|else|throw|try|await)\\w[\\w<>\\[\\],\\s\\.\\?]*\\s+(\\w+)\\s*\\(`, 'm'), kind: 'method', nameGroup: 1 },
  { regex: new RegExp(`^${CS_PREFIX}event\\s+[\\w<>\\[\\],\\s\\.\\?]+\\s+(\\w+)`, 'm'), kind: 'variable', nameGroup: 1 },
  { regex: new RegExp(`^${CS_PREFIX}[\\w<>\\[\\],\\s\\.\\?]+\\s+(\\w+)\\s*\\{\\s*(?:get|set|init)`, 'm'), kind: 'variable', nameGroup: 1 },
];
