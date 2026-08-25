/**
 * SA4E-95 - HarnessParser: recursive descent parser for Pega harness/section hierarchy.
 * Walks: Harness -> pySections -> pySectionBody -> pyRows -> pyCells -> FIELD
 * Implements BR-01, BR-09, BR-15. Field extraction delegated to FieldExtractor.
 *
 * Dual-strategy section discovery:
 * 1. Rule-based: walk pySections, resolve pxRuleReferences
 * 2. LLM-based: ask LLM to identify sections/fields from raw harness JSON
 * Results are merged (union) to minimize information loss.
 */
import type { ParsedHarness, PageContext } from '../models/ParsedHarness.js';
import type { ParsedSection, BodyType } from '../models/ParsedSection.js';
import type { ExtractedField } from '../models/ExtractedField.js';
import type { RepeatDefinition } from '../models/RepeatDefinition.js';
import type { ResolvedContext } from '../models/ResolvedContext.js';
import type { TemplateMarker } from '../models/TemplateMarker.js';
import type { HarnessFetcher } from '../fetcher/HarnessFetcher.js';
import type { IPageContextResolver } from '../resolver/PageContextResolver.js';
import type { IClassHierarchyResolver } from '../resolver/ClassHierarchyResolver.js';
import { FieldExtractor } from './FieldExtractor.js';

/** Internal parse context passed through recursion */
interface ParseContext { primaryClass: string; contextPages: PageContext[]; ruleType: string; }

/** LLM-extracted section info (output from LLM analysis) */
export interface LlmExtractedSection {
  name: string;
  description: string;
  fields: Array<{ propertyName: string; type: string; description: string; required: boolean }>;
}

/** Optional LLM service interface for section extraction. */
export interface ILlmSectionExtractor {
  /**
   * Ask LLM to analyze raw harness JSON and identify sections + fields.
   * @param harnessJson Raw harness JSON
   * @param ruleType The rule type (e.g. "Rule-Obj-Flow")
   * @returns Array of LLM-identified sections with fields
   */
  extractSections(harnessJson: Record<string, unknown>, ruleType: string): Promise<LlmExtractedSection[]>;
}

/** Interface for the harness parser */
export interface IHarnessParser {
  parse(harnessJson: Record<string, unknown>): Promise<ParsedHarness>;
}

/** Recursive descent parser. Max depth 5 (BR-09), circular ref detection (BR-15). */
export class HarnessParser implements IHarnessParser {
  private static readonly MAX_DEPTH = 5;
  private templateMarkers: TemplateMarker[] = [];
  private readonly fieldExtractor = new FieldExtractor();

  constructor(
    private readonly fetcher: HarnessFetcher,
    private readonly hierarchyResolver: IClassHierarchyResolver,
    private readonly contextResolver: IPageContextResolver,
    private readonly llmExtractor?: ILlmSectionExtractor,
  ) {}

  /** Parse a full harness JSON into intermediate representation */
  async parse(harnessJson: Record<string, unknown>): Promise<ParsedHarness> {
    this.templateMarkers = [];
    const ruleType = String(harnessJson.pxObjClass ?? '');
    const primaryClass = String(harnessJson.pyClassName ?? ruleType);
    const contextPages = this.extractContextPages(harnessJson);
    const ctx: ParseContext = { primaryClass, contextPages, ruleType };

    // Strategy 1: Rule-based section discovery
    let ruleSections = await this.parseSections(harnessJson, ctx, 0, new Set());

    // Fallback: stream-rendered harnesses → resolve from pxRuleReferences
    if (ruleSections.length === 0) {
      ruleSections = await this.resolveReferencedSections(harnessJson, ctx);
    }

    // SA4E-214 Phase D: Detect stream-rendered harness (pySourceStream present) —
    // force LLM extraction when standard parse is empty, even if no pxRuleReferences
    const isStreamRendered = Boolean(harnessJson.pySourceStream) && ruleSections.length === 0;

    // Strategy 2: LLM-based section discovery (complements rule-based)
    // For stream-rendered harnesses, LLM is the primary strategy (not just supplement)
    const llmSections = await this.extractSectionsViaLlm(harnessJson, ruleType, ctx);

    // Merge: union of both strategies
    const sections = this.mergeSections(ruleSections, llmSections);

    return {
      ruleType, primaryClass, contextPages, sections,
      templateMarkers: [...this.templateMarkers],
      metadata: {
        insKey: String(harnessJson.pzInsKey ?? ''),
        updateDateTime: String(harnessJson.pxUpdateDateTime ?? ''),
        ruleSetVersion: String(harnessJson.pyRuleSetVersion ?? ''),
      },
    };
  }

  /**
   * Strategy 2: LLM-based extraction.
   * Returns ParsedSection[] from LLM analysis. Non-fatal: returns [] on failure.
   */
  private async extractSectionsViaLlm(
    harnessJson: Record<string, unknown>, ruleType: string, ctx: ParseContext,
  ): Promise<ParsedSection[]> {
    if (!this.llmExtractor) return [];
    try {
      const llmResult = await this.llmExtractor.extractSections(harnessJson, ruleType);
      return llmResult.map(s => this.convertLlmSection(s, ctx));
    } catch {
      return []; // LLM failure is non-fatal — rule-based output still available
    }
  }

  /** Convert LLM output to ParsedSection format. */
  private convertLlmSection(llmSection: LlmExtractedSection, ctx: ParseContext): ParsedSection {
    const pageCtx: ResolvedContext = { className: ctx.primaryClass, objectPath: '', source: 'primary' };
    const fields: ExtractedField[] = llmSection.fields.map(f => ({
      propertyName: f.propertyName,
      pyFormat: f.type || 'pxTextInput',
      readOnly: false,
      label: f.description,
      required: f.required,
      pageContext: ctx.primaryClass,
    }));
    return {
      name: llmSection.name,
      sourceClass: ctx.primaryClass,
      bodyType: 'INCLUDE',
      pageContext: pageCtx,
      fields,
      children: [],
      depth: 0,
    };
  }

  /**
   * Merge rule-based and LLM-based sections.
   * LLM sections supplement rule-based: add new sections not found by rules,
   * and add new fields to existing sections.
   */
  private mergeSections(ruleSections: ParsedSection[], llmSections: ParsedSection[]): ParsedSection[] {
    if (llmSections.length === 0) return ruleSections;
    if (ruleSections.length === 0) return llmSections;

    const merged = [...ruleSections];
    const existingNames = new Set(ruleSections.map(s => s.name.toLowerCase()));

    for (const llmSection of llmSections) {
      const existing = merged.find(s => s.name.toLowerCase() === llmSection.name.toLowerCase());
      if (existing) {
        // Merge fields: add LLM fields not already in rule-based section
        const existingFieldNames = new Set(existing.fields.map(f => f.propertyName));
        for (const field of llmSection.fields) {
          if (!existingFieldNames.has(field.propertyName)) {
            existing.fields.push(field);
          }
        }
      } else {
        // New section from LLM — add it
        merged.push(llmSection);
      }
    }
    return merged;
  }

  /**
   * Fallback for stream-rendered harnesses (pySourceStream):
   * Extract section names from pxRuleReferences and resolve them via hierarchy resolver.
   */
  private async resolveReferencedSections(
    harnessJson: Record<string, unknown>, ctx: ParseContext
  ): Promise<ParsedSection[]> {
    const refs = harnessJson.pxRuleReferences;
    if (!Array.isArray(refs)) return [];

    const sectionNames: string[] = [];
    for (const ref of refs) {
      if (!ref || typeof ref !== 'object') continue;
      const r = ref as Record<string, unknown>;
      if (r.pxRuleObjClass === 'Rule-HTML-Section' && typeof r.pyRuleName === 'string') {
        const name = r.pyRuleName as string;
        if (name && !name.startsWith('pz')) sectionNames.push(name);
      }
    }

    const results: ParsedSection[] = [];
    const visited = new Set<string>();
    for (const sectionName of sectionNames) {
      if (visited.has(sectionName)) continue;
      visited.add(sectionName);
      try {
        const resolved = await this.hierarchyResolver.resolveSection(sectionName, ctx.primaryClass);
        if (!resolved) continue;
        const pageCtx = this.contextResolver.resolve('', ctx.contextPages, ctx.primaryClass);
        const fields = this.fieldExtractor.extractFromJson(resolved.sectionJson, pageCtx);
        const children = await this.parseSections(resolved.sectionJson, ctx, 1, new Set(visited));
        results.push({
          name: sectionName, sourceClass: resolved.resolvedClass, bodyType: 'INCLUDE',
          pageContext: pageCtx, fields, children, depth: 0,
        });
      } catch { /* non-fatal: section not resolvable */ }
    }
    return results;
  }

  private extractContextPages(json: Record<string, unknown>): PageContext[] {
    const pages = json.pyPagesAndClasses;
    if (!Array.isArray(pages)) return [];
    return pages
      .filter((p): p is Record<string, unknown> => p != null && typeof p === 'object')
      .map((p) => ({
        page: String(p.pyPageName ?? p.page ?? ''),
        className: String(p.pyClassName ?? ''),
        mode: p.pyMode ? String(p.pyMode) : undefined,
      }));
  }

  private async parseSections(
    json: Record<string, unknown>, ctx: ParseContext, depth: number, visited: Set<string>
  ): Promise<ParsedSection[]> {
    const sections = json.pySections ?? json.pySectionBody;
    if (!Array.isArray(sections)) return [];
    const results: ParsedSection[] = [];
    for (const s of sections) {
      if (!s || typeof s !== 'object') continue;
      const parsed = await this.parseSectionBody(s as Record<string, unknown>, ctx, depth, visited);
      if (parsed) results.push(parsed);
    }
    return results;
  }

  private async parseSectionBody(
    body: Record<string, unknown>, ctx: ParseContext, depth: number, visited: Set<string>
  ): Promise<ParsedSection | null> {
    const bodyType = this.determineBodyType(body);
    const name = String(body.pyInclude ?? body.pyStreamName ?? body.pySectionName ?? 'unnamed');
    const pageCtx = this.contextResolver.resolve(
      String(body.pyUsingPage ?? ''), ctx.contextPages, ctx.primaryClass
    );
    switch (bodyType) {
      case 'INCLUDE': return this.handleInclude(body, name, pageCtx, ctx, depth, visited);
      case 'REPEATLAYOUT': return this.handleRepeat(body, name, pageCtx, ctx, depth, visited);
      case 'TEMPLATE': return this.handleTemplate(name, pageCtx, ctx, depth);
      default: return this.handleLayout(body, name, bodyType, pageCtx, ctx, depth, visited);
    }
  }

  private determineBodyType(body: Record<string, unknown>): BodyType {
    const raw = String(body.pyBodyType ?? '').toUpperCase();
    if (raw === 'INCLUDE' || body.pyInclude) return 'INCLUDE';
    if (raw === 'TEMPLATE') return 'TEMPLATE';
    if (body.pyPageListProperty) return 'REPEATLAYOUT';
    if (raw === 'FREEFORM') return 'FREEFORM';
    if (raw === 'SIMPLELAYOUT' || body.pyRows) return 'SIMPLELAYOUT';
    return 'UNKNOWN';
  }

  private async handleInclude(
    body: Record<string, unknown>, name: string, pageCtx: ResolvedContext,
    ctx: ParseContext, depth: number, visited: Set<string>
  ): Promise<ParsedSection> {
    const sectionName = String(body.pyInclude ?? name);
    const empty: ParsedSection = {
      name: sectionName, sourceClass: ctx.primaryClass, bodyType: 'INCLUDE',
      pageContext: pageCtx, fields: [], children: [], depth,
    };
    // BR-15: circular ref / BR-09: max depth
    if (visited.has(sectionName) || depth >= HarnessParser.MAX_DEPTH) return empty;
    visited.add(sectionName);
    try {
      const resolved = await this.hierarchyResolver.resolveSection(sectionName, ctx.primaryClass);
      if (!resolved) return empty;
      const children = await this.parseSections(resolved.sectionJson, ctx, depth + 1, visited);
      const fields = this.fieldExtractor.extractFromJson(resolved.sectionJson, pageCtx);
      return { name: sectionName, sourceClass: resolved.resolvedClass, bodyType: 'INCLUDE',
        pageContext: pageCtx, fields, children, depth };
    } finally { visited.delete(sectionName); }
  }

  private async handleLayout(
    body: Record<string, unknown>, name: string, bodyType: BodyType,
    pageCtx: ResolvedContext, ctx: ParseContext, depth: number, visited: Set<string>
  ): Promise<ParsedSection> {
    const fields = this.fieldExtractor.extractFromJson(body, pageCtx);
    const children = await this.parseNested(body, ctx, depth, visited);
    return { name, sourceClass: ctx.primaryClass, bodyType, pageContext: pageCtx, fields, children, depth };
  }

  private async handleRepeat(
    body: Record<string, unknown>, name: string, pageCtx: ResolvedContext,
    ctx: ParseContext, depth: number, visited: Set<string>
  ): Promise<ParsedSection> {
    const rawProp = String(body.pyPageListProperty ?? '');
    const propertyName = rawProp.startsWith('.') ? rawProp.substring(1) : rawProp;
    const itemClass = String(body.pyPageListPropertyClass ?? '');
    const fields = this.fieldExtractor.extractFromJson(body, pageCtx);
    const children = await this.parseNested(body, ctx, depth, visited);
    const repeatProperty: RepeatDefinition = { propertyName, itemClass, fields, nestedRepeats: [] };
    return { name, sourceClass: ctx.primaryClass, bodyType: 'REPEATLAYOUT',
      pageContext: pageCtx, fields: [], repeatProperty, children, depth };
  }

  private handleTemplate(
    name: string, pageCtx: ResolvedContext, ctx: ParseContext, depth: number
  ): ParsedSection {
    this.templateMarkers.push({
      sectionName: name, ruleType: ctx.ruleType,
      reason: 'TEMPLATE layout - JS-rendered, cannot parse statically',
    });
    return { name, sourceClass: ctx.primaryClass, bodyType: 'TEMPLATE',
      pageContext: pageCtx, fields: [], children: [], depth };
  }

  private async parseNested(
    body: Record<string, unknown>, ctx: ParseContext, depth: number, visited: Set<string>
  ): Promise<ParsedSection[]> {
    const nested = body.pySectionBody ?? body.pySections;
    if (!Array.isArray(nested)) return [];
    const results: ParsedSection[] = [];
    for (const child of nested) {
      if (!child || typeof child !== 'object') continue;
      const p = await this.parseSectionBody(child as Record<string, unknown>, ctx, depth + 1, visited);
      if (p) results.push(p);
    }
    return results;
  }
}
