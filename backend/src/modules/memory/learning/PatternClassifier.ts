/**
 * SA4E-122: PatternClassifier — classifies extracted text segments
 * into one of 5 pattern types using keyword/heuristic analysis.
 * Strategy pattern: each classifier is a scoring function.
 */

import type { PatternType } from './types.js';

/** Scoring strategy for a single pattern type. */
interface ClassificationStrategy {
  type: PatternType;
  score(text: string): number;
}

/** Keyword sets for each pattern type. */
const ERROR_KEYWORDS = [
  'error', 'exception', 'fix', 'resolved', 'solution',
  'stack trace', 'failed', 'crash', 'bug', 'issue',
];

const CORRECTION_KEYWORDS = [
  'no,', 'actually', 'instead', 'not that', 'wrong',
  'correction', 'should be', 'meant', 'let me clarify',
];

const WORKAROUND_KEYWORDS = [
  'workaround', 'hack', 'temporary', 'bypass', 'instead of',
  'alternative', 'fallback', 'trick', 'shortcut',
];

const DEBUG_KEYWORDS = [
  'debug', 'breakpoint', 'log', 'inspect', 'trace',
  'step through', 'console.log', 'print', 'diagnose',
];

const PROJECT_KEYWORDS = [
  'this project', 'our codebase', 'convention', 'pattern',
  'always use', 'never use', 'prefer', 'standard',
];

/** Count keyword matches in text (case-insensitive). */
function countMatches(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.reduce((count, kw) => {
    return count + (lower.includes(kw) ? 1 : 0);
  }, 0);
}

/** Normalize score to 0–1 range based on keyword density. */
function normalizeScore(matches: number, total: number): number {
  if (total === 0) return 0;
  return Math.min(1, matches / Math.max(3, total * 0.3));
}

/** All classification strategies — one per pattern type. */
const STRATEGIES: ClassificationStrategy[] = [
  {
    type: 'error_resolution',
    score: (text) => normalizeScore(countMatches(text, ERROR_KEYWORDS), ERROR_KEYWORDS.length),
  },
  {
    type: 'user_correction',
    score: (text) => normalizeScore(countMatches(text, CORRECTION_KEYWORDS), CORRECTION_KEYWORDS.length),
  },
  {
    type: 'workaround',
    score: (text) => normalizeScore(countMatches(text, WORKAROUND_KEYWORDS), WORKAROUND_KEYWORDS.length),
  },
  {
    type: 'debugging_technique',
    score: (text) => normalizeScore(countMatches(text, DEBUG_KEYWORDS), DEBUG_KEYWORDS.length),
  },
  {
    type: 'project_specific',
    score: (text) => normalizeScore(countMatches(text, PROJECT_KEYWORDS), PROJECT_KEYWORDS.length),
  },
];

export class PatternClassifier {
  /**
   * Classify a text segment into the best-matching pattern type.
   * Returns the type with the highest score, or 'project_specific' as fallback.
   * @param text The text segment to classify
   * @returns Tuple of [PatternType, confidence score]
   */
  classify(text: string): [PatternType, number] {
    if (!text.trim()) return ['project_specific', 0];

    let bestType: PatternType = 'project_specific';
    let bestScore = 0;

    for (const strategy of STRATEGIES) {
      const score = strategy.score(text);
      if (score > bestScore) {
        bestScore = score;
        bestType = strategy.type;
      }
    }

    return [bestType, bestScore];
  }

  /**
   * Check if text contains error→resolution sequence.
   * Heuristic: error keyword followed by fix/solution keyword.
   */
  hasErrorResolutionSequence(text: string): boolean {
    const lower = text.toLowerCase();
    const hasError = ['error', 'exception', 'failed', 'crash'].some(k => lower.includes(k));
    const hasFix = ['fix', 'resolved', 'solution', 'works now'].some(k => lower.includes(k));
    return hasError && hasFix;
  }
}
