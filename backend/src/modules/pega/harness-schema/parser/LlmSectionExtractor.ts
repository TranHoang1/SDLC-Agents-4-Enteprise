/**
 * LlmSectionExtractor — LLM-based section/field extraction from raw Pega harness JSON.
 * Complements rule-based HarnessParser by identifying sections and semantically
 * important fields that hardcoded logic may miss (stream-rendered harnesses, etc.).
 */

import type { ILlmSectionExtractor, LlmExtractedSection } from './HarnessParser.js';

/** Minimal LLM interface — matches LLMService.complete() signature. */
export interface ILlmService {
  complete(messages: Array<{ role: string; content: string }>): Promise<{ content: string }>;
}

/** Max harness JSON size to send to LLM (chars). Truncate to fit context window. */
const MAX_HARNESS_CHARS = 12_000;

/** System prompt for LLM section extraction. */
const SYSTEM_PROMPT = `You are a Pega Platform expert analyzing a RuleForm harness JSON.
A harness defines how a rule type is displayed/edited in Pega Dev Studio.
Your job: identify the SECTIONS (tabs/panels) and their FIELDS (properties users edit).

Look for:
1. pxRuleReferences with pxRuleObjClass="Rule-HTML-Section" → these are section inclusions
2. pyRows/pyCells with pyType="FIELD" and pyValue=".propertyName" → these are editable fields
3. pyPageListProperty references → these are repeat/list sections
4. Embedded objects (pyCallParams, pyShapes, pyConnectors) → important data structures
5. Tab labels, section names in pyLabel/pyCaption fields

Return JSON array of sections. Each section has:
- name: section identifier
- description: what this section represents (1 sentence)
- fields: array of { propertyName, type, description, required }

Types: "string", "boolean", "number", "array", "object", "reference"

IMPORTANT: Focus on fields that carry BUSINESS LOGIC and CONFIGURATION, not UI metadata.
Skip px*/pz* internal fields. Skip pyJava*, pyVisio* rendering fields.

Return ONLY valid JSON array. No markdown, no explanation.`;

/**
 * Implementation: calls LLM to analyze harness JSON and extract sections.
 */
export class LlmSectionExtractor implements ILlmSectionExtractor {
  constructor(private readonly llm: ILlmService) {}

  async extractSections(
    harnessJson: Record<string, unknown>,
    ruleType: string,
  ): Promise<LlmExtractedSection[]> {
    const truncated = this.truncateHarness(harnessJson);
    const userPrompt = `Analyze this Pega RuleForm harness for rule type "${ruleType}".\n\nHarness JSON:\n${truncated}`;

    const response = await this.llm.complete([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ]);

    return this.parseResponse(response.content);
  }

  /** Truncate harness JSON to fit LLM context, keeping most relevant parts. */
  private truncateHarness(json: Record<string, unknown>): string {
    // Keep: pxRuleReferences, pySections, pyPagesAndClasses, pyScriptsAndBundles
    // Remove: large binary/rendering fields
    const slim: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(json)) {
      // Skip large irrelevant fields
      if (key === 'pyJavaStream' || key === 'pyVisioBinary' || key === 'pyVisioJpeg') continue;
      if (key === 'pySourceStream' || key === 'pyFooterActions' || key === 'pyHeaderActions') continue;
      if (typeof val === 'string' && val.length > 500) {
        slim[key] = val.substring(0, 200) + '...(truncated)';
      } else {
        slim[key] = val;
      }
    }
    const str = JSON.stringify(slim, null, 1);
    if (str.length <= MAX_HARNESS_CHARS) return str;
    return str.substring(0, MAX_HARNESS_CHARS) + '\n...(truncated)';
  }

  /** Parse LLM response into typed sections. Graceful fallback on parse failure. */
  private parseResponse(raw: string): LlmExtractedSection[] {
    // Try direct JSON parse
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return this.validateSections(parsed);
    } catch { /* try fence extraction */ }

    // Try markdown code fence
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      try {
        const parsed = JSON.parse(fenceMatch[1].trim());
        if (Array.isArray(parsed)) return this.validateSections(parsed);
      } catch { /* fallback below */ }
    }

    // Try extracting array from response
    const arrayMatch = raw.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        const parsed = JSON.parse(arrayMatch[0]);
        if (Array.isArray(parsed)) return this.validateSections(parsed);
      } catch { /* give up */ }
    }

    return [];
  }

  /** Validate and normalize LLM output. */
  private validateSections(raw: unknown[]): LlmExtractedSection[] {
    const results: LlmExtractedSection[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const s = item as Record<string, unknown>;
      const name = String(s.name || '');
      if (!name) continue;
      const fields = Array.isArray(s.fields) ? s.fields.map((f: any) => ({
        propertyName: String(f.propertyName || f.name || ''),
        type: String(f.type || 'string'),
        description: String(f.description || ''),
        required: Boolean(f.required),
      })).filter(f => f.propertyName.length > 0) : [];
      results.push({
        name,
        description: String(s.description || ''),
        fields,
      });
    }
    return results;
  }
}
