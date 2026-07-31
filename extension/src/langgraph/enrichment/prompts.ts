/**
 * prompts.ts — SA4E-79: LLM prompts for client-side KB entry enrichment.
 * Temperature: 0.3, MaxTokens: 1000, Output: JSON.
 */

/** System prompt for the enrichment LLM call. */
export const ENRICHMENT_SYSTEM_PROMPT = `You are a knowledge base enrichment assistant.
Given raw content from a KB entry, extract structured metadata.
Respond ONLY with valid JSON matching the schema below.

Output JSON Schema:
{
  "summary": "string (max 500 chars, concise description)",
  "tags": "string (comma-separated keywords, max 500 chars total)",
  "structured_map": {
    "summary": "string (1-2 sentence overview)",
    "business_entities": ["string array of key entities/classes/systems"],
    "actors": ["string array of actors/users/services involved"],
    "business_rules": ["string array of rules/constraints mentioned"],
    "tags": ["string array of categorization tags"]
  }
}`;

/** Max content length sent to LLM — limits attack surface and token usage. */
const MAX_CONTENT_FOR_LLM = 4000;

/**
 * Build the user prompt with content delimiters for injection defense.
 * @param content - Raw KB entry content (will be truncated to 4000 chars)
 * @returns Formatted user prompt string
 */
export const buildEnrichmentUserPrompt = (content: string): string =>
  `Analyze this KB entry content and extract metadata:\n\n---\n${content.slice(0, MAX_CONTENT_FOR_LLM)}\n---`;
