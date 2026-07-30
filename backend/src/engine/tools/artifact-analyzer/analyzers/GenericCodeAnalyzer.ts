import type { ArtifactAnalyzer, ArtifactAnalysis, ArtifactType } from '../types.js';

// Mapping from code patterns to likely language names
const LANGUAGE_KEYWORDS: Record<string, string[]> = {
  TypeScript: ['interface', 'type ', 'as ', ': string', ': number', ': boolean', ': any', ': void'],
  JavaScript: ['module.exports', 'require(', '=>', 'const ', 'let ', 'var '],
  Python: ['def ', 'import ', 'from ', 'class ', 'if __name__', 'elif ', 'except ', 'with ', 'as '],
  Java: ['public class', 'private ', 'protected ', 'void main', 'System.out', '@Override', 'import java', 'package '],
  'C++': ['#include', 'std::', 'int main', 'cout <<', '::iterator', 'template ', 'virtual '],
  'C#': ['using System', 'namespace ', 'class ', 'void Main', 'string[] args', 'Console.', 'async Task'],
  Go: ['package main', 'func ', 'import (', 'defer ', 'go func', ':=', 'error '],
  Rust: ['fn ', 'let mut', 'impl ', 'pub fn', 'use std', 'struct ', 'enum ', 'match '],
  Ruby: ['def ', 'end', 'require ', 'class ', 'attr_accessor', 'do |', 'puts '],
  PHP: ['<?php', 'function ', '$', 'echo ', 'namespace ', 'use ', 'class '],
  Swift: ['import UIKit', 'func ', 'var ', 'let ', 'class ', 'struct ', 'enum ', 'guard '],
  Kotlin: ['fun ', 'val ', 'var ', 'class ', 'import ', 'package ', 'override fun', 'data class'],
  Scala: ['object ', 'def ', 'val ', 'var ', 'class ', 'trait ', 'import ', 'extends '],
  Haskell: ['module ', 'import ', 'main =', '::', 'where', 'data ', 'type '],
  Lua: ['function ', 'local ', 'end', 'if ', 'then', 'else', 'return '],
  R: ['<-', 'function(', 'library(', 'data.frame', 'ggplot'],
  Dart: ['void main', 'class ', 'import ', 'final ', 'const ', '=>', '@override'],
};

const CODE_KEYWORDS = [
  /\bimport\s+/,
  /\bexport\s+/,
  /\bfunction\s+\w+\s*\(/,
  /\bdef\s+\w+\s*\(/,
  /\bclass\s+\w+/,
  /\binterface\s+\w+/,
  /#include\s+/,
  /\busing\s+(System|namespace)/,
  /\bmodule\.exports\b/,
  /\brequire\s*\(/,
  /\bpublic\s+class\b/,
  /\bprivate\s+\w+/,
  /\bprotected\s+\w+/,
  /\bconst\s+\w+\s*=/,
  /\blet\s+\w+\s*=/,
  /\bvar\s+\w+\s*=/,
  /\bfun\s+\w+\s*\(/,
  /\bsub\s+\w+/,
  /\bdef\b.*\bend\b/,
  /\bpackage\s+\w+/,
  /\bnamespace\s+\w+/,
];

function detectLanguage(content: string): string | null {
  // Count matches per language and pick the highest scoring one
  let bestLanguage: string | null = null;
  let bestScore = 0;

  for (const [lang, keywords] of Object.entries(LANGUAGE_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (content.includes(kw)) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestLanguage = lang;
    }
  }

  return bestScore > 0 ? bestLanguage : null;
}

function countMatches(content: string, patterns: RegExp[]): number {
  let count = 0;
  for (const p of patterns) {
    const matches = content.match(p);
    if (matches) {
      count += matches.length;
    }
  }
  return count;
}

export class GenericCodeAnalyzer implements ArtifactAnalyzer {
  type: ArtifactType = 'code';

  canAnalyze(content: string): boolean {
    return CODE_KEYWORDS.some(p => p.test(content));
  }

  analyze(content: string, _options?: Record<string, unknown>): ArtifactAnalysis {
    const lines = content.split('\n');
    const lineCount = lines.length;
    const charCount = content.length;
    const language = detectLanguage(content);

    // Collect import/includes/using statements
    const importLines: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed.startsWith('import ') ||
        trimmed.startsWith('#include') ||
        trimmed.startsWith('using ') ||
        trimmed.startsWith('from ') ||
        trimmed.startsWith('require(') ||
        trimmed.startsWith('package ') ||
        trimmed.startsWith('namespace ')
      ) {
        importLines.push(trimmed);
      }
    }

    // Count functions and classes
    const functionCount = countMatches(content, [
      /\bfunction\s+\w+\s*\(/g,
      /\bdef\s+\w+\s*\(/g,
      /\bfun\s+\w+\s*\(/g,
      /\bfn\s+\w+/g,
      /\bsub\s+\w+/g,
      /\bvoid\s+\w+\s*\(/g,
    ]);

    const classCount = countMatches(content, [
      /\bclass\s+\w+/g,
      /\binterface\s+\w+/g,
    ]);

    const languageLabel = language ? ` (${language})` : '';

    return {
      type: 'code',
      summary: `Code artifact${languageLabel} — ${lineCount} lines, ${charCount} chars`,
      promptContext: [
        `## Code Artifact Analysis`,
        ``,
        `This appears to be source code${languageLabel}.`,
        `- Lines: ${lineCount}`,
        `- Characters: ${charCount}`,
        `- Functions/methods detected: ${functionCount}`,
        `- Classes/interfaces detected: ${classCount}`,
        `- Import/include statements: ${importLines.length}`,
        ``,
        importLines.length > 0
          ? `### Dependencies (imports/includes)\n${importLines.join('\n')}`
          : null,
        ``,
        `> For deep code context (callers, callees, tests, git history), use the \`get_edit_context\` tool with the file path.`,
      ]
        .filter(Boolean)
        .join('\n'),
      details: {
        lines: lineCount,
        chars: charCount,
        language,
        functionCount,
        classCount,
        importCount: importLines.length,
        imports: importLines,
      },
      detectedBy: 'content-heuristic',
    };
  }
}
