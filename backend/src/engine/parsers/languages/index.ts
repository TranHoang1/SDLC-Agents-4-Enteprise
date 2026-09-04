/**
 * Language routing table for the regex-based signature extractor (SA4E-225).
 * Maps a language id (as produced by TreeSitterIndexer.extToLanguage) to its
 * PatternDef[] set. Existing sets are re-exported from ./builtin; the 9 new
 * languages are added below. The keys mirror the existing 7 + 9 new = 16 ids.
 */

import type { PatternDef } from '../signature-extractor.js';
import {
  TS_PATTERNS, KOTLIN_PATTERNS, PYTHON_PATTERNS, JAVA_PATTERNS,
  GO_PATTERNS, RUST_PATTERNS, APEX_PATTERNS,
} from './builtin.js';
import { SCALA_PATTERNS } from './scala.js';
import { C_PATTERNS } from './c.js';
import { CPP_PATTERNS } from './cpp.js';
import { CSHARP_PATTERNS } from './csharp.js';
import { RUBY_PATTERNS } from './ruby.js';
import { PHP_PATTERNS } from './php.js';
import { SWIFT_PATTERNS } from './swift.js';
import { BASH_PATTERNS } from './bash.js';
import { POWERSHELL_PATTERNS } from './powershell.js';

export const LANGUAGE_PATTERNS: Record<string, PatternDef[]> = {
  // Existing (relocated from signature-extractor.ts)
  typescript: TS_PATTERNS, javascript: TS_PATTERNS,
  kotlin: KOTLIN_PATTERNS, python: PYTHON_PATTERNS,
  java: JAVA_PATTERNS, go: GO_PATTERNS, rust: RUST_PATTERNS, apex: APEX_PATTERNS,
  // ── NEW (SA4E-225) ──
  scala: SCALA_PATTERNS,
  c: C_PATTERNS, cpp: CPP_PATTERNS,
  csharp: CSHARP_PATTERNS,
  ruby: RUBY_PATTERNS,
  php: PHP_PATTERNS,
  swift: SWIFT_PATTERNS,
  bash: BASH_PATTERNS,
  powershell: POWERSHELL_PATTERNS,
};
