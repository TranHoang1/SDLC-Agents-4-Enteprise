/**
 * Swift regex symbol-extraction patterns (SA4E-225).
 * All patterns are anchored with `^` and run under the forced `m` flag (ReDoS-safe).
 *
 * Security condition C4: the modifier group is `(?:(?:modifier)\s+)*` so a modifier
 * REQUIRES a following space — `public class Foo` matches, but `publicclass Foo` does
 * not (the group fails to consume "public" without a space, then the literal keyword
 * is expected and not found). `protocol`->interface, `extension`/`actor`->class.
 */

import type { PatternDef } from '../signature-extractor.js';

const SWIFT_PREFIX = '(?:@\\w+\\s+)*(?:(?:final|open|public|internal|private|fileprivate|static)\\s+)*';

export const SWIFT_PATTERNS: PatternDef[] = [
  { regex: new RegExp(`^${SWIFT_PREFIX}class\\s+(\\w+)`, 'm'), kind: 'class', nameGroup: 1 },
  { regex: new RegExp(`^${SWIFT_PREFIX}struct\\s+(\\w+)`, 'm'), kind: 'struct', nameGroup: 1 },
  { regex: new RegExp(`^${SWIFT_PREFIX}protocol\\s+(\\w+)`, 'm'), kind: 'interface', nameGroup: 1 },
  { regex: new RegExp(`^${SWIFT_PREFIX}enum\\s+(\\w+)`, 'm'), kind: 'enum', nameGroup: 1 },
  { regex: new RegExp(`^${SWIFT_PREFIX}func\\s+(\\w+)`, 'm'), kind: 'function', nameGroup: 1 },
  { regex: new RegExp(`^${SWIFT_PREFIX}extension\\s+(\\w+)`, 'm'), kind: 'class', nameGroup: 1 },
  { regex: new RegExp(`^${SWIFT_PREFIX}actor\\s+(\\w+)`, 'm'), kind: 'class', nameGroup: 1 },
  { regex: new RegExp(`^${SWIFT_PREFIX}(?:var|let)\\s+(\\w+)`, 'm'), kind: 'variable', nameGroup: 1 },
];
