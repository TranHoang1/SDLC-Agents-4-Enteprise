/**
 * SA4E-107: Prompt builder for code enrichment LLM calls.
 * Builds structured prompts per enrichment strategy (CLASS, FUNCTION, PEGA).
 */

import type { LLMMessage } from '../../modules/memory/llm/types.js';
import type { EnrichmentStrategy, SymbolContext } from './types.js';
import { VALID_TAG_CATEGORIES } from './types.js';

/** Maximum token estimate for body text sent to LLM. */
const MAX_BODY_TOKENS = 4000;

/**
 * Builds LLM prompts for code enrichment based on strategy and context.
 * Each strategy produces a system + user message pair.
 */
export class CodeEnrichmentPromptBuilder {
  /**
   * Build LLM messages for a given strategy and symbol context.
   * @param strategy - Which enrichment strategy to apply
   * @param context - Symbol metadata and source content
   * @returns Array of LLM messages (system + user)
   */
  build(strategy: EnrichmentStrategy, context: SymbolContext): LLMMessage[] {
    switch (strategy) {
      case 'CLASS_SUMMARY': return this.buildClassSummary(context);
      case 'FUNCTION_SUMMARY': return this.buildFunctionSummary(context);
      case 'TAG_EXTRACTION': return this.buildTagExtraction(context);
      case 'PEGA_SUMMARY': return this.buildPegaSummary(context);
    }
  }

  private buildClassSummary(ctx: SymbolContext): LLMMessage[] {
    const system = this.classSystemPrompt();
    const user = this.buildClassUserPrompt(ctx);
    return [{ role: 'system', content: system }, { role: 'user', content: user }];
  }

  private buildFunctionSummary(ctx: SymbolContext): LLMMessage[] {
    const system = this.functionSystemPrompt();
    const user = this.buildFunctionUserPrompt(ctx);
    return [{ role: 'system', content: system }, { role: 'user', content: user }];
  }

  private buildTagExtraction(ctx: SymbolContext): LLMMessage[] {
    const system = this.tagSystemPrompt();
    const user = this.buildTagUserPrompt(ctx);
    return [{ role: 'system', content: system }, { role: 'user', content: user }];
  }

  private buildPegaSummary(ctx: SymbolContext): LLMMessage[] {
    const system = this.pegaSystemPrompt();
    const user = this.buildPegaUserPrompt(ctx);
    return [{ role: 'system', content: system }, { role: 'user', content: user }];
  }

  private classSystemPrompt(): string {
    return `You are a code analyst. Summarize the given class/interface/enum.
Return JSON only: {"summary":"<1-3 sentences>","tags":["category:value",...]}
Valid tag categories: ${VALID_TAG_CATEGORIES.join(', ')}
Tag values: lowercase, alphanumeric + hyphens only.`;
  }

  private functionSystemPrompt(): string {
    return `You are a code analyst. Summarize the function/method and produce pseudo code.
Return JSON only: {"summary":"<1-3 sentences>","pseudo_code":"<structured pseudo code>","tags":["category:value",...]}
Valid tag categories: ${VALID_TAG_CATEGORIES.join(', ')}
Tag values: lowercase, alphanumeric + hyphens only.
CRITICAL pseudo_code format rules:
- Use \\n for line breaks between steps
- Indent nested blocks with 2 spaces
- Use IF/ELSE/END IF, FOR/END FOR, TRY/CATCH keywords
- Number the steps (1. 2. 3.) for sequential logic
- Max 2000 chars
Example: "1. Parse input params\\n2. IF cache hit THEN\\n  return cached\\nEND IF\\n3. Query database\\n4. Transform result\\n5. Return response"`;
  }

  private tagSystemPrompt(): string {
    return `You are a code analyst. Extract semantic tags for the given symbol.
Return JSON only: {"tags":["category:value",...]}
Valid tag categories: ${VALID_TAG_CATEGORIES.join(', ')}
Tag values: lowercase, alphanumeric + hyphens only. Max 8 tags.`;
  }

  private pegaSystemPrompt(): string {
    return `You are a Pega platform analyst. Analyze the business purpose and logic of this Pega rule.
Return JSON only: {"summary":"<1-3 sentences describing business purpose>","pseudo_code":"<structured pseudo code>","tags":["category:value",...]}
Valid tag categories: ${VALID_TAG_CATEGORIES.join(', ')}
Tag values: lowercase, alphanumeric + hyphens only. Max 8 tags.
Focus on business intent and the main logic flow (steps, decisions, expressions).
CRITICAL pseudo_code format rules:
- Use \\n for line breaks between steps
- Indent nested blocks with 2 spaces
- Use IF/ELSE/END IF, FOR/END FOR, WHILE/END WHILE keywords
- Number the steps (1. 2. 3.) for sequential logic
- Max 2000 chars
Example: "1. Validate input\\n2. IF condition THEN\\n  2a. Do action A\\n  2b. Do action B\\nELSE\\n  2c. Do fallback\\nEND IF\\n3. Return result"`;
  }

  private buildClassUserPrompt(ctx: SymbolContext): string {
    const parts = [`[${ctx.kind}] ${ctx.name}`];
    if (ctx.signature) parts.push(`Signature: ${ctx.signature}`);
    if (ctx.docComment) parts.push(`Documentation: ${ctx.docComment}`);
    if (ctx.childMembers?.length) {
      parts.push(`Members: ${ctx.childMembers.slice(0, 20).join(', ')}`);
    }
    return parts.join('\n');
  }

  private buildFunctionUserPrompt(ctx: SymbolContext): string {
    const parts = [`[${ctx.kind}] ${ctx.name}`];
    if (ctx.signature) parts.push(`Signature: ${ctx.signature}`);
    if (ctx.docComment) parts.push(`Documentation: ${ctx.docComment}`);
    if (ctx.bodyText) {
      const truncated = this.truncateToTokens(ctx.bodyText, MAX_BODY_TOKENS);
      parts.push(`Body:\n${truncated}`);
    }
    return parts.join('\n');
  }

  private buildTagUserPrompt(ctx: SymbolContext): string {
    const parts = [`[${ctx.kind}] ${ctx.name}`];
    if (ctx.signature) parts.push(`Signature: ${ctx.signature}`);
    if (ctx.bodyText) {
      parts.push(`Body (first 500 chars): ${ctx.bodyText.slice(0, 500)}`);
    }
    return parts.join('\n');
  }

  private buildPegaUserPrompt(ctx: SymbolContext): string {
    const parts = [`[${ctx.kind}] ${ctx.name}`];
    if (ctx.pegaClass) parts.push(`Class: ${ctx.pegaClass}`);
    if (ctx.pegaRuleset) parts.push(`RuleSet: ${ctx.pegaRuleset}`);
    if (ctx.signature) parts.push(`Signature: ${ctx.signature}`);
    // SA4E-106: rule body (steps/params/Java) extracted from rule.json
    if (ctx.bodyText) {
      const truncated = this.truncateToTokens(ctx.bodyText, MAX_BODY_TOKENS);
      parts.push(`Rule Content:\n${truncated}`);
    }
    if (ctx.existingPseudoCode) {
      parts.push(`Existing Pseudo Code:\n${ctx.existingPseudoCode}`);
    }
    return parts.join('\n');
  }

  /** Estimate token count by whitespace split, truncate to max tokens. */
  private truncateToTokens(text: string, maxTokens: number): string {
    const words = text.split(/\s+/);
    if (words.length <= maxTokens) return text;
    return words.slice(0, maxTokens).join(' ') + '...';
  }
}
