/**
 * SA4E-214 — SchemaAnalyzeService: dual-strategy analysis coordinator.
 * Rule-based parsing first (fast, deterministic), LLM fallback when empty (BR-10).
 * R-03: Wraps harness content in delimiters for LLM prompts.
 */

import type { Logger } from 'pino';
import type { FieldDescriptor, ExtractionHints } from '../../../models/pega-schema.models.js';

/** Response structure from analyze operation */
export interface AnalyzeResult {
  fields: FieldDescriptor[];
  sub_sections: string[];
  rule_based_coverage: number;
  llm_fallback_used: boolean;
  hints: Partial<ExtractionHints>;
}

/** Minimal LLM interface for fallback extraction */
export interface ILlmAnalyzer {
  analyzeHarness(harnessJson: Record<string, unknown>, ruleType: string): Promise<{
    fields: FieldDescriptor[];
    sub_sections: string[];
  }>;
}

/**
 * Dual-strategy analysis: rule-based field extraction first, LLM fallback.
 * Pattern: Strategy — switches between rule-based and LLM approaches.
 */
export class SchemaAnalyzeService {
  constructor(
    private readonly logger: Logger,
    private readonly llmAnalyzer: ILlmAnalyzer | null,
  ) {}

  /**
   * Analyze harness/section JSON to extract fields and sub-sections.
   * @param harnessJson Raw harness or section JSON from Pega
   * @param ruleType Pega rule class (e.g., "Rule-Obj-Flow")
   * @param depth Current recursion depth (0 = root harness)
   */
  async analyze(
    harnessJson: Record<string, unknown>,
    ruleType: string,
    depth: number,
  ): Promise<AnalyzeResult> {
    // Phase 1: Rule-based extraction (deterministic, fast)
    const ruleBasedFields = this.extractFieldsRuleBased(harnessJson, ruleType);
    const subSections = this.detectSubSections(harnessJson);
    const coverage = this.calculateCoverage(ruleBasedFields, harnessJson);

    // If rule-based found fields, use them (no LLM needed)
    if (ruleBasedFields.length > 0) {
      return {
        fields: ruleBasedFields,
        sub_sections: subSections,
        rule_based_coverage: coverage,
        llm_fallback_used: false,
        hints: this.deriveHints(ruleBasedFields, ruleType),
      };
    }

    // Phase 2: LLM fallback for stream-rendered or empty harnesses
    if (this.llmAnalyzer && this.isLlmFallbackNeeded(harnessJson)) {
      this.logger.info({ ruleType, depth }, '[schema-analyze] Rule-based empty — LLM fallback');
      try {
        const llmResult = await this.llmAnalyzer.analyzeHarness(harnessJson, ruleType);
        return {
          fields: llmResult.fields,
          sub_sections: [...subSections, ...llmResult.sub_sections],
          rule_based_coverage: 0,
          llm_fallback_used: true,
          hints: this.deriveHints(llmResult.fields, ruleType),
        };
      } catch (err: any) {
        this.logger.warn({ err: err.message, ruleType }, '[schema-analyze] LLM fallback failed');
      }
    }

    // Fallback: return whatever we have (may be empty)
    return {
      fields: ruleBasedFields,
      sub_sections: subSections,
      rule_based_coverage: coverage,
      llm_fallback_used: false,
      hints: {},
    };
  }

  // ─── Rule-Based Extraction ──────────────────────────────────────────────

  /** Extract fields from harness JSON using deterministic rules. */
  private extractFieldsRuleBased(json: Record<string, unknown>, ruleType: string): FieldDescriptor[] {
    const fields: FieldDescriptor[] = [];
    const seen = new Set<string>();

    // Strategy 1: Look for pxRuleReferences with field bindings
    this.extractFromRuleReferences(json, fields, seen);

    // Strategy 2: Look for pyRows/pyCells with pyValue bindings
    this.extractFromCellBindings(json, fields, seen);

    // Strategy 3: Look for top-level properties that look like data fields
    this.extractTopLevelDataFields(json, fields, seen, ruleType);

    return fields;
  }

  /** Extract from pxRuleReferences array. */
  private extractFromRuleReferences(
    json: Record<string, unknown>, fields: FieldDescriptor[], seen: Set<string>,
  ): void {
    const refs = json['pxRuleReferences'];
    if (!Array.isArray(refs)) return;

    for (const ref of refs) {
      if (!ref || typeof ref !== 'object') continue;
      const r = ref as Record<string, unknown>;
      const propName = String(r['pyPropertyName'] || r['pyValue'] || '');
      if (!propName || propName.startsWith('px') || propName.startsWith('pz')) continue;
      if (seen.has(propName)) continue;
      seen.add(propName);

      fields.push({
        path: propName.replace(/^\./, ''),
        category: this.inferCategory(propName),
        type: this.inferFieldType(r),
        description: String(r['pyLabel'] || r['pyCaption'] || ''),
        frequency: 'common',
      });
    }
  }

  /** Extract from pyRows → pyCells hierarchy. */
  private extractFromCellBindings(
    json: Record<string, unknown>, fields: FieldDescriptor[], seen: Set<string>,
  ): void {
    const traverse = (obj: unknown): void => {
      if (!obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) { obj.forEach(traverse); return; }

      const record = obj as Record<string, unknown>;
      const value = record['pyValue'];
      if (typeof value === 'string' && value.startsWith('.') && value.length > 1) {
        const propName = value.substring(1);
        if (!propName.startsWith('px') && !propName.startsWith('pz') && !seen.has(propName)) {
          seen.add(propName);
          fields.push({
            path: propName,
            category: this.inferCategory(propName),
            type: record['pyType'] === 'CHECKBOX' ? 'boolean' : 'string',
            description: String(record['pyLabel'] || record['pyCaption'] || ''),
            frequency: 'common',
          });
        }
      }
      // Recurse into children
      for (const val of Object.values(record)) {
        if (typeof val === 'object' && val !== null) traverse(val);
      }
    };
    traverse(json['pyRows'] || json['pySections']);
  }

  /** Extract top-level data fields (non-internal, non-rendering). */
  private extractTopLevelDataFields(
    json: Record<string, unknown>, fields: FieldDescriptor[], seen: Set<string>, ruleType: string,
  ): void {
    const SKIP_PREFIXES = ['px', 'pz', 'pyJava', 'pyVisio', 'pyFooter', 'pyHeader'];
    for (const [key, val] of Object.entries(json)) {
      if (seen.has(key)) continue;
      if (SKIP_PREFIXES.some(p => key.startsWith(p))) continue;
      if (key === 'pxObjClass' || key === 'pxCreateDateTime') continue;

      // Only include fields with actual data content
      if (val === null || val === '' || val === undefined) continue;
      seen.add(key);

      fields.push({
        path: key,
        category: this.inferCategory(key),
        type: this.inferTypeFromValue(val),
        description: '',
        frequency: 'common',
      });
    }
  }

  // ─── Sub-Section Detection ──────────────────────────────────────────────

  /** Detect sub-sections that need recursive analysis. */
  private detectSubSections(json: Record<string, unknown>): string[] {
    const sections: string[] = [];
    const refs = json['pxRuleReferences'];
    if (!Array.isArray(refs)) return sections;

    for (const ref of refs) {
      if (!ref || typeof ref !== 'object') continue;
      const r = ref as Record<string, unknown>;
      if (r['pxRuleObjClass'] === 'Rule-HTML-Section') {
        const name = String(r['pyRuleName'] || '');
        if (name) sections.push(name);
      }
    }
    return sections;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  /** Determine if LLM fallback should run (stream-rendered harness detection). */
  private isLlmFallbackNeeded(json: Record<string, unknown>): boolean {
    // Stream-rendered harness: has pySourceStream but no structured pySections
    if (json['pySourceStream'] && !json['pySections']) return true;
    // Empty structured data: no pxRuleReferences, no pyRows
    if (!json['pxRuleReferences'] && !json['pyRows'] && !json['pySections']) return true;
    return false;
  }

  /** Calculate coverage as ratio of known fields vs total non-internal keys. */
  private calculateCoverage(fields: FieldDescriptor[], json: Record<string, unknown>): number {
    const totalKeys = Object.keys(json).filter(
      k => !k.startsWith('px') && !k.startsWith('pz'),
    ).length;
    if (totalKeys === 0) return 0;
    return Math.min(100, Math.round((fields.length / totalKeys) * 100));
  }

  /** Infer category from property name patterns. */
  private inferCategory(name: string): FieldDescriptor['category'] {
    if (/^py(ClassName|RuleName|RuleSet|Label|Purpose)/.test(name)) return 'identity';
    if (/^py(Steps|Connector|Decision|Flow|Action|When)/.test(name)) return 'logic';
    if (/^py(DataPage|Service|Connect|Queue|External)/.test(name)) return 'connectivity';
    return 'metadata';
  }

  /** Infer type from pxRuleReference metadata. */
  private inferFieldType(ref: Record<string, unknown>): string {
    const objClass = String(ref['pxRuleObjClass'] || '');
    if (objClass.includes('List') || objClass.includes('Page')) return 'array';
    if (objClass.includes('Boolean')) return 'boolean';
    return 'string';
  }

  /** Infer type from value. */
  private inferTypeFromValue(val: unknown): string {
    if (Array.isArray(val)) return 'array';
    if (typeof val === 'boolean') return 'boolean';
    if (typeof val === 'number') return 'number';
    if (typeof val === 'object') return 'object';
    return 'string';
  }

  /** Derive extraction hints from fields. */
  private deriveHints(fields: FieldDescriptor[], ruleType: string): Partial<ExtractionHints> {
    const logicFields = fields.filter(f => f.category === 'logic');
    const primary = logicFields.length > 0 ? logicFields[0].path : null;

    // Infer logic structure from rule type
    let structure: string | null = null;
    if (ruleType.includes('Flow')) structure = 'sequential_steps';
    else if (ruleType.includes('Decision')) structure = 'decision_tree';
    else if (ruleType.includes('Activity')) structure = 'procedural_steps';

    // SA4E-222 Scope B: array-typed logic fields are candidate nested logic paths.
    const nestedLogicPaths = logicFields
      .filter(f => f.type === 'array')
      .map(f => f.path);

    return {
      primary_logic_field: primary,
      logic_structure: structure,
      summary_focus: null,
      // Backward compatible (optional in schema): empty when no array logic found.
      nested_logic_paths: nestedLogicPaths,
    };
  }
}
