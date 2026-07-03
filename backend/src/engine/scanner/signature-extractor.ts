/**
 * Signature Extractor — Multi-language regex-based symbol extraction.
 * Extracts functions, classes, interfaces, and other symbols from source files.
 */

export interface ExtractedSymbol {
  name: string;
  kind: SymbolKind;
  signature: string;
  startLine: number;
  endLine: number;
  parentSymbol: string | null;
  visibility: string | null;
  docComment: string | null;
}

export type SymbolKind =
  | 'function' | 'class' | 'interface' | 'method'
  | 'enum' | 'type' | 'constant' | 'variable'
  | 'module' | 'namespace' | 'trait' | 'struct';

interface PatternDef {
  regex: RegExp;
  kind: SymbolKind;
  nameGroup: number;
  signatureGroup?: number;
}

/** Extract symbols from source content based on language. */
export function extractSymbols(content: string, language: string): ExtractedSymbol[] {
  const patterns = getPatterns(language);
  if (!patterns.length) return [];

  const lines = content.split('\n');
  const symbols: ExtractedSymbol[] = [];

  for (const pattern of patterns) {
    extractWithPattern(lines, content, pattern, symbols);
  }

  return deduplicateSymbols(symbols);
}

function extractWithPattern(
  lines: string[], content: string, pattern: PatternDef, symbols: ExtractedSymbol[]
): void {
  const matches = content.matchAll(new RegExp(pattern.regex, 'gm'));
  for (const match of matches) {
    if (!match.index && match.index !== 0) continue;
    const startLine = content.slice(0, match.index).split('\n').length;
    const name = match[pattern.nameGroup];
    if (!name || name.length > 100) continue;

    symbols.push({
      name,
      kind: pattern.kind,
      signature: (match[pattern.signatureGroup ?? 0] ?? match[0]).trim().slice(0, 500),
      startLine,
      endLine: estimateEndLine(lines, startLine),
      parentSymbol: null,
      visibility: extractVisibility(match[0]),
      docComment: extractDocComment(lines, startLine - 1),
    });
  }
}

function estimateEndLine(lines: string[], startLine: number): number {
  let depth = 0;
  let foundOpen = false;
  for (let i = startLine - 1; i < lines.length && i < startLine + 200; i++) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === '{') { depth++; foundOpen = true; }
      if (ch === '}') depth--;
    }
    if (foundOpen && depth <= 0) return i + 1;
  }
  return Math.min(startLine + 1, lines.length);
}

function extractVisibility(text: string): string | null {
  if (/\bpublic\b/.test(text)) return 'public';
  if (/\bprivate\b/.test(text)) return 'private';
  if (/\bprotected\b/.test(text)) return 'protected';
  if (/\binternal\b/.test(text)) return 'internal';
  if (/\bexport\b/.test(text)) return 'export';
  return null;
}

function extractDocComment(lines: string[], lineIdx: number): string | null {
  const comments: string[] = [];
  for (let i = lineIdx - 1; i >= Math.max(0, lineIdx - 15); i--) {
    const line = lines[i].trim();
    if (line.startsWith('*') || line.startsWith('/**') || line.startsWith('///') || line.startsWith('#')) {
      comments.unshift(line.replace(/^\/\*\*|\*\/|\*|\/\/\/|#\s?/g, '').trim());
    } else if (line === '') {
      continue;
    } else {
      break;
    }
  }
  return comments.length > 0 ? comments.join(' ').slice(0, 500) : null;
}

function deduplicateSymbols(symbols: ExtractedSymbol[]): ExtractedSymbol[] {
  const seen = new Set<string>();
  return symbols.filter(s => {
    const key = `${s.name}:${s.startLine}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getPatterns(language: string): PatternDef[] {
  switch (language) {
    case 'typescript': case 'javascript': return TS_PATTERNS;
    case 'kotlin': return KOTLIN_PATTERNS;
    case 'python': return PYTHON_PATTERNS;
    case 'java': return JAVA_PATTERNS;
    case 'go': return GO_PATTERNS;
    case 'rust': return RUST_PATTERNS;
    default: return GENERIC_PATTERNS;
  }
}

const TS_PATTERNS: PatternDef[] = [
  { regex: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/m, kind: 'function', nameGroup: 1 },
  { regex: /^(?:export\s+)?class\s+(\w+)/m, kind: 'class', nameGroup: 1 },
  { regex: /^(?:export\s+)?interface\s+(\w+)/m, kind: 'interface', nameGroup: 1 },
  { regex: /^(?:export\s+)?type\s+(\w+)/m, kind: 'type', nameGroup: 1 },
  { regex: /^(?:export\s+)?enum\s+(\w+)/m, kind: 'enum', nameGroup: 1 },
  { regex: /^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\(/m, kind: 'function', nameGroup: 1 },
];

const KOTLIN_PATTERNS: PatternDef[] = [
  { regex: /^\s*(?:(?:public|private|internal|protected)\s+)?(?:suspend\s+)?fun\s+(\w+)/m, kind: 'function', nameGroup: 1 },
  { regex: /^\s*(?:(?:public|private|internal|protected)\s+)?(?:data\s+|sealed\s+|abstract\s+|open\s+)?class\s+(\w+)/m, kind: 'class', nameGroup: 1 },
  { regex: /^\s*(?:(?:public|private|internal|protected)\s+)?interface\s+(\w+)/m, kind: 'interface', nameGroup: 1 },
  { regex: /^\s*(?:(?:public|private|internal|protected)\s+)?object\s+(\w+)/m, kind: 'module', nameGroup: 1 },
  { regex: /^\s*(?:(?:public|private|internal|protected)\s+)?enum\s+class\s+(\w+)/m, kind: 'enum', nameGroup: 1 },
];

const PYTHON_PATTERNS: PatternDef[] = [
  { regex: /^(?:async\s+)?def\s+(\w+)/m, kind: 'function', nameGroup: 1 },
  { regex: /^class\s+(\w+)/m, kind: 'class', nameGroup: 1 },
];

const JAVA_PATTERNS: PatternDef[] = [
  { regex: /^\s*(?:(?:public|private|protected)\s+)?(?:static\s+)?(?:[\w<>\[\]]+\s+)(\w+)\s*\(/m, kind: 'function', nameGroup: 1 },
  { regex: /^\s*(?:(?:public|private|protected)\s+)?(?:abstract\s+)?class\s+(\w+)/m, kind: 'class', nameGroup: 1 },
  { regex: /^\s*(?:(?:public|private|protected)\s+)?interface\s+(\w+)/m, kind: 'interface', nameGroup: 1 },
  { regex: /^\s*(?:(?:public|private|protected)\s+)?enum\s+(\w+)/m, kind: 'enum', nameGroup: 1 },
];

const GO_PATTERNS: PatternDef[] = [
  { regex: /^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)/m, kind: 'function', nameGroup: 1 },
  { regex: /^type\s+(\w+)\s+struct/m, kind: 'struct', nameGroup: 1 },
  { regex: /^type\s+(\w+)\s+interface/m, kind: 'interface', nameGroup: 1 },
];

const RUST_PATTERNS: PatternDef[] = [
  { regex: /^\s*(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/m, kind: 'function', nameGroup: 1 },
  { regex: /^\s*(?:pub\s+)?struct\s+(\w+)/m, kind: 'struct', nameGroup: 1 },
  { regex: /^\s*(?:pub\s+)?trait\s+(\w+)/m, kind: 'trait', nameGroup: 1 },
  { regex: /^\s*(?:pub\s+)?enum\s+(\w+)/m, kind: 'enum', nameGroup: 1 },
  { regex: /^\s*(?:pub\s+)?mod\s+(\w+)/m, kind: 'module', nameGroup: 1 },
];

const GENERIC_PATTERNS: PatternDef[] = [
  { regex: /^(?:function|def|func|fn|sub)\s+(\w+)/m, kind: 'function', nameGroup: 1 },
  { regex: /^(?:class|struct|type)\s+(\w+)/m, kind: 'class', nameGroup: 1 },
];
