/**
 * SA4E-107: Code Enrichment module — re-exports.
 */

export { CodeEnrichmentHandler } from './CodeEnrichmentHandler.js';
export { CodeEnrichmentPromptBuilder } from './CodeEnrichmentPromptBuilder.js';
export { CodeEnrichmentTaskCreator } from './CodeEnrichmentTaskCreator.js';
export { validateTags, isValidTagCategory } from './tag-validator.js';
export type {
  CodeEnrichmentPayload,
  CodeEnrichmentLLMResponse,
  EnrichmentStrategy,
  SymbolContext,
  EnrichmentStatus,
  TagCategory,
} from './types.js';
export { VALID_TAG_CATEGORIES, CodeEnrichmentPayloadSchema } from './types.js';
