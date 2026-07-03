/**
 * KSA-160: Budget Allocator — allocates token budget across ranked results.
 * Top results get full source, middle get signatures, bottom get references.
 */

import { MergedResult, ContextItem } from './types.js';

export interface AllocatedResult extends MergedResult {
  detail: 'full' | 'signature' | 'reference';
  content: string;
  tokens: number;
}

export class BudgetAllocator {
  private CHARS_PER_TOKEN = 4;

  /** Allocate token budget across merged results with progressive detail levels. */
  allocate(results: MergedResult[], maxTokens: number): AllocatedResult[] {
    const allocated: AllocatedResult[] = [];
    let tokensUsed = 100; // Response overhead

    const highThreshold = Math.max(1, Math.ceil(results.length * 0.2));
    const medThreshold = Math.ceil(results.length * 0.6);

    for (let i = 0; i < results.length; i++) {
      if (tokensUsed >= maxTokens) break;

      const result = results[i];
      let detail: 'full' | 'signature' | 'reference';
      let content: string;
      let tokens: number;

      if (i < highThreshold) {
        detail = 'full';
        content = result.source_code || result.content || result.signature || result.name;
        tokens = this.estimateTokens(content);
      } else if (i < medThreshold) {
        detail = 'signature';
        content = result.signature || result.name;
        tokens = this.estimateTokens(content);
      } else {
        detail = 'reference';
        content = `${result.name} (${result.file || 'unknown'}:${result.line || 0})`;
        tokens = 15;
      }

      // Downgrade if exceeds budget
      if (tokensUsed + tokens > maxTokens && detail === 'full') {
        detail = 'signature';
        content = result.signature || result.name;
        tokens = this.estimateTokens(content);
      }

      if (tokensUsed + tokens <= maxTokens) {
        allocated.push({ ...result, detail, content, tokens });
        tokensUsed += tokens;
      }
    }

    return allocated;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / this.CHARS_PER_TOKEN);
  }
}
