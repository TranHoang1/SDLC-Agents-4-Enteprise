/**
 * SA4E-222 Scope B — PegaSchemaCreator.
 *
 * Extracted from CodeEnrichmentHandler.createSchemaOnTheFly / storeEnrichedSchema.
 * Creates an EnrichedSchema on-the-fly via LLM and persists it through
 * SchemaStorageService using the CANONICAL key `pega-schema:{ruleType}` (pure JSON),
 * replacing the legacy `pega-schema-enriched/{ruleType}` prefixed format. This fixes
 * DISC-1 so schema-driven renderers (which read the canonical key) actually find the
 * on-the-fly schemas. On LLM failure the schema is simply not created (non-fatal).
 */

import type { Logger } from 'pino';
import type { LLMService } from '../../memory/llm/LLMService.js';
import type { EnrichedSchema } from '../../../models/pega-schema.models.js';
import type { ISchemaStorageService } from './SchemaStorageService.js';

const SCHEMA_CREATION_SYSTEM_PROMPT = `You are a Pega Platform expert. Analyze the rule instance JSON and produce a schema describing its fields.
Return ONLY valid JSON (no markdown, no explanation) shaped like:
{ "ruleType": "...", "extractionHints": { "primary_logic_field": "...", "logic_structure": "...", "summary_focus": "...", "nested_logic_paths": ["pyModelProcess.pyShapes", "pyStages[].pyProcesses[]"], "path_render_hint": "..." } }
The nested_logic_paths MUST list the dotted/bracketed JSON paths where business LOGIC lives (arrays of steps/shapes/stages/rows/conditions). Skip internal px*/pz* fields.`;

export class PegaSchemaCreator {
  constructor(
    private readonly llm: LLMService,
    private readonly storage: ISchemaStorageService,
    private readonly logger: Logger,
  ) {}

  /** Ask the LLM to characterize a rule instance and produce an EnrichedSchema. */
  async createSchemaOnTheFly(ruleType: string, sampleBody: string): Promise<EnrichedSchema | null> {
    const truncated = sampleBody.length > 6000 ? sampleBody.substring(0, 6000) + '...' : sampleBody;
    const messages = [
      { role: 'system' as const, content: SCHEMA_CREATION_SYSTEM_PROMPT },
      { role: 'user' as const, content: `Rule Type: ${ruleType}\n\nSample Rule Instance:\n${truncated}` },
    ];
    try {
      const raw = await this.llm.complete(messages as any);
      return this.parseLlmSchema(raw.content, ruleType);
    } catch (err) {
      this.logger.debug({ err, ruleType }, '[schema-creator] LLM schema creation failed (non-fatal)');
      return null;
    }
  }

  /** Persist a schema via the canonical storage service. Throws on duplicate ruleType. */
  async storeSchema(schema: EnrichedSchema): Promise<number> {
    return this.storage.store(schema);
  }

  /** Parse LLM output into a valid EnrichedSchema, defaulting all required fields. */
  private parseLlmSchema(raw: string, ruleType: string): EnrichedSchema | null {
    let jsonText = raw.trim();
    const fence = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) jsonText = fence[1].trim();
    const objMatch = jsonText.match(/\{[\s\S]*\}/);
    if (objMatch) jsonText = objMatch[0];

    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return null;
    }

    const hints = parsed?.extraction_hints ?? parsed ?? {};
    const nested: string[] = Array.isArray(hints.nested_logic_paths)
      ? hints.nested_logic_paths.filter((p: unknown) => typeof p === 'string')
      : [];
    const now = new Date().toISOString();

    return {
      rule_type: ruleType,
      schema_version: 1,
      created_at: now,
      updated_at: now,
      identity_fields: {},
      logic_fields: {},
      connectivity_fields: {},
      extraction_hints: {
        primary_logic_field: typeof hints.primary_logic_field === 'string' ? hints.primary_logic_field : null,
        logic_structure: typeof hints.logic_structure === 'string' ? hints.logic_structure : null,
        summary_focus: typeof hints.summary_focus === 'string' ? hints.summary_focus : null,
        nested_logic_paths: nested,
        path_render_hint: typeof hints.path_render_hint === 'string' ? hints.path_render_hint : null,
      },
      known_fields: [],
      coverage: 0,
      discovered_sections: [],
    };
  }
}
