/**
 * SA4E-79: Client-side KB entry enrichment module.
 * Barrel export for EnrichmentObserver, EnrichmentDedup, and prompts.
 */

export { EnrichmentObserver } from "./EnrichmentObserver";
export { EnrichmentDedup } from "./EnrichmentDedup";
export { ENRICHMENT_SYSTEM_PROMPT, buildEnrichmentUserPrompt } from "./prompts";
