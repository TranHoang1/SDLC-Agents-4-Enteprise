/**
 * KSA-158: Intent Strategies — maps intent to prioritized section list.
 */

export interface SectionDef {
  name: string;
  priority: number;
  format: 'full' | 'summary' | 'signatures';
}

export interface IntentStrategy {
  intent: string;
  sections: SectionDef[];
}

const STRATEGIES: Record<string, IntentStrategy> = {
  explain: {
    intent: 'explain',
    sections: [
      { name: 'source', priority: 1, format: 'full' },
      { name: 'doc_comment', priority: 2, format: 'full' },
      { name: 'siblings', priority: 3, format: 'signatures' },
      { name: 'imports', priority: 4, format: 'full' },
      { name: 'callers', priority: 5, format: 'summary' },
      { name: 'callees', priority: 6, format: 'summary' },
      { name: 'type_definitions', priority: 7, format: 'full' },
    ]
  },
  modify: {
    intent: 'modify',
    sections: [
      { name: 'source', priority: 1, format: 'full' },
      { name: 'callers', priority: 2, format: 'full' },
      { name: 'callees', priority: 3, format: 'full' },
      { name: 'tests', priority: 4, format: 'full' },
      { name: 'imports', priority: 5, format: 'full' },
      { name: 'type_definitions', priority: 6, format: 'full' },
      { name: 'siblings', priority: 7, format: 'signatures' },
    ]
  },
  debug: {
    intent: 'debug',
    sections: [
      { name: 'source', priority: 1, format: 'full' },
      { name: 'callers', priority: 2, format: 'full' },
      { name: 'error_patterns', priority: 3, format: 'full' },
      { name: 'recent_changes', priority: 4, format: 'full' },
      { name: 'imports', priority: 5, format: 'full' },
      { name: 'siblings', priority: 6, format: 'signatures' },
      { name: 'callees', priority: 7, format: 'summary' },
    ]
  },
  test: {
    intent: 'test',
    sections: [
      { name: 'source', priority: 1, format: 'full' },
      { name: 'tests', priority: 2, format: 'full' },
      { name: 'test_patterns', priority: 3, format: 'full' },
      { name: 'callees', priority: 4, format: 'full' },
      { name: 'type_definitions', priority: 5, format: 'full' },
      { name: 'mocks_needed', priority: 6, format: 'full' },
      { name: 'siblings', priority: 7, format: 'signatures' },
    ]
  }
};

/** Get the intent strategy (section priorities) for a given intent. Falls back to 'explain'. */
export function getStrategy(intent: string): IntentStrategy {
  return STRATEGIES[intent] || STRATEGIES.explain;
}

/** Get all supported intent names. */
export function getSupportedIntents(): string[] {
  return Object.keys(STRATEGIES);
}
