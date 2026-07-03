/**
 * KSA-160: Query Analyzer — extracts keywords, symbol candidates, and phrases from NL queries.
 */

import { QueryAnalysis } from './types.js';

const STOP_WORDS = new Set([
  'how', 'does', 'the', 'is', 'what', 'where', 'when', 'a', 'an', 'in',
  'for', 'to', 'of', 'and', 'or', 'not', 'this', 'that', 'with', 'from',
  'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had', 'do', 'did',
  'will', 'would', 'could', 'should', 'may', 'might', 'can', 'shall',
  'its', 'it', 'they', 'them', 'their', 'we', 'our', 'you', 'your',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
  'such', 'than', 'too', 'very', 'just', 'but', 'about', 'above', 'after',
  'before', 'between', 'into', 'through', 'during', 'until', 'while'
]);

export class QueryAnalyzer {
  /** Analyze a natural language query into search components. */
  analyze(query: string): QueryAnalysis {
    // Tokenize: lowercase, remove special chars, split
    const tokens = query.toLowerCase()
      .replace(/[^\w\s.\-_]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2 && !STOP_WORDS.has(t));

    // Identify symbol candidates (camelCase, PascalCase, snake_case, dot.notation)
    const symbolCandidates = query.match(
      /[A-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)?|[a-z]+(?:_[a-z_]+)+|[a-z]+[A-Z][a-zA-Z0-9]*/g
    ) || [];

    // Extract bigrams for phrase search
    const phrases: string[] = [];
    for (let i = 0; i < tokens.length - 1; i++) {
      phrases.push(`${tokens[i]} ${tokens[i + 1]}`);
    }

    // Build FTS query (OR-joined keywords)
    const ftsQuery = tokens.length > 0 ? tokens.join(' OR ') : query;

    return {
      originalQuery: query,
      keywords: tokens,
      symbolCandidates,
      phrases,
      ftsQuery
    };
  }
}
