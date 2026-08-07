/**
 * PegaSchemaGenerator — Orchestrates JSON Schema generation from Pega RuleForms (SA4E-93).
 * Pipeline: crawl → group → fetch → parse → generate → save.
 * Partial success pattern (BR-08): skip individual failures, continue.
 */

import type {
  SchemaGenerationResult, SchemaError, HarnessSummary,
  ControlDefinition, JsonSchema, JsonSchemaProperty,
} from "../models";
import type { PegaHttpClient } from "./PegaHttpClient";
import type { HarnessSectionParser } from "./HarnessSectionParser";
import type { ControlTypeMapper } from "./ControlTypeMapper";
import type { SchemaWriter } from "./SchemaWriter";
import type { ProgressReporter } from "./IndexingService";

/** Page size for harness crawling (BR-05) */
const PAGE_SIZE = 50;

export class PegaSchemaGenerator {
  constructor(
    private readonly pegaClient: PegaHttpClient,
    private readonly sectionParser: HarnessSectionParser,
    private readonly controlMapper: ControlTypeMapper,
    private readonly schemaWriter: SchemaWriter,
    private readonly workspaceRoot: string,
    private readonly log: (msg: string) => void,
  ) {}

  /**
   * Execute full schema generation pipeline.
   * @param report VS Code progress reporter for UI feedback
   * @returns Summary of generation results
   * @throws On fatal errors only (server unreachable, auth failure)
   */
  public async generateSchemas(report: ProgressReporter): Promise<SchemaGenerationResult> {
    const errors: SchemaError[] = [];
    const summaries = await this.crawlHarnesses(report);
    if (summaries.length === 0) {
      return this.buildResult(0, 0, 0, 0, errors);
    }
    const ruleTypeMap = this.groupByRuleType(summaries);
    report.report({ message: `Grouping ${summaries.length} harnesses into ${ruleTypeMap.size} rule types...` });
    const { generated, failed } = await this.processRuleTypes(ruleTypeMap, errors, report);
    return this.buildResult(summaries.length, ruleTypeMap.size, generated, failed, errors);
  }

  /** Crawl all RuleForm harnesses with pagination (BR-05, BR-12) */
  private async crawlHarnesses(report: ProgressReporter): Promise<HarnessSummary[]> {
    const all: HarnessSummary[] = [];
    let pageIndex = 1;
    let hasMore = true;
    while (hasMore) {
      report.report({ message: `Crawling Pega harnesses (page ${pageIndex})...` });
      const response = await this.pegaClient.listRulesByFilter(
        "Rule-HTML-Harness", "pyStreamName", "RuleForm", PAGE_SIZE, pageIndex,
      );
      const parsed = this.mapToSummaries(response.pxResults);
      all.push(...parsed);
      hasMore = response.pxMore;
      pageIndex++;
    }
    this.log(`[SchemaGen] Crawled ${all.length} harness summaries in ${pageIndex - 1} pages.`);
    return all;
  }

  /** Group summaries by pyClassName → unique rule types (BR-11) */
  private groupByRuleType(summaries: HarnessSummary[]): Map<string, HarnessSummary> {
    const map = new Map<string, HarnessSummary>();
    for (const s of summaries) {
      if (s.pyClassName && !map.has(s.pyClassName)) {
        map.set(s.pyClassName, s);
      }
    }
    return map;
  }

  /** Process each rule type: fetch, parse, build schema, write */
  private async processRuleTypes(
    ruleTypeMap: Map<string, HarnessSummary>,
    errors: SchemaError[],
    report: ProgressReporter,
  ): Promise<{ generated: number; failed: number }> {
    let generated = 0;
    let failed = 0;
    const entries = Array.from(ruleTypeMap.entries());
    for (let i = 0; i < entries.length; i++) {
      const [ruleType, summary] = entries[i];
      report.report({ message: `Processing ${ruleType} (${i + 1}/${entries.length})...` });
      const ok = await this.processOneRuleType(ruleType, summary, errors);
      if (ok) { generated++; } else { failed++; }
    }
    return { generated, failed };
  }

  /** Process a single rule type — returns true on success */
  private async processOneRuleType(
    ruleType: string, summary: HarnessSummary, errors: SchemaError[],
  ): Promise<boolean> {
    try {
      const controls = await this.fetchAndParse(ruleType, summary);
      if (controls.length === 0) {
        this.log(`[SchemaGen] No controls found for ${ruleType}, skipping.`);
        errors.push({ ruleType, phase: "parse", message: "No controls extracted" });
        return false;
      }
      const schema = this.buildSchema(ruleType, controls);
      await this.schemaWriter.writeSchema(ruleType, schema, this.workspaceRoot);
      this.log(`[SchemaGen] ✅ Schema written for ${ruleType}`);
      return true;
    } catch (err: any) {
      const phase = this.classifyErrorPhase(err);
      errors.push({ ruleType, phase, message: err.message });
      this.log(`[SchemaGen] ⚠️ Failed ${ruleType}: ${err.message}`);
      return false;
    }
  }

  /** Fetch full harness JSON by pzInsKey and extract controls */
  private async fetchAndParse(
    ruleType: string, summary: HarnessSummary,
  ): Promise<ControlDefinition[]> {
    // SA4E-93 fix: Use getRuleByInsKey with pzInsKey from listRules results.
    // queryRuleByTriple fails with 404 because harness resolution needs exact insKey.
    const harnessJson = await this.pegaClient.getRuleByInsKey(summary.pzInsKey);
    return this.sectionParser.extractControls(harnessJson);
  }

  /** Build JSON Schema draft-07 from control definitions */
  private buildSchema(ruleType: string, controls: ControlDefinition[]): JsonSchema {
    const properties: Record<string, JsonSchemaProperty> = {};
    // Always include pxObjClass as const (BR-06 system fields)
    properties.pxObjClass = { type: "string", const: ruleType, description: "Pega rule class identifier" };
    properties.pyClassName = { type: "string", description: "Class this rule applies to" };
    properties.pyRuleName = { type: "string", description: "Rule name" };
    for (const ctrl of controls) {
      properties[ctrl.fieldName] = this.controlMapper.mapControlToSchema(ctrl);
    }
    const required = this.collectRequired(controls);
    return {
      $schema: "http://json-schema.org/draft-07/schema#",
      title: `${ruleType} Schema`,
      description: `Auto-generated schema from Pega RuleForm harness for ${ruleType}`,
      type: "object",
      properties,
      required,
      additionalProperties: true,
    };
  }

  /** Collect required fields from controls (BR-02) */
  private collectRequired(controls: ControlDefinition[]): string[] {
    const req = ["pxObjClass", "pyClassName", "pyRuleName"];
    for (const ctrl of controls) {
      if (ctrl.required && !req.includes(ctrl.fieldName)) {
        req.push(ctrl.fieldName);
      }
    }
    return req;
  }

  /** Map raw pxResults to typed HarnessSummary objects */
  private mapToSummaries(results: Record<string, unknown>[]): HarnessSummary[] {
    return results.map((r) => ({
      pzInsKey: (r.pzInsKey as string) || "",
      pxObjClass: (r.pxObjClass as string) || "Rule-HTML-Harness",
      pyClassName: (r.pyClassName as string) || "",
      pyRuleName: (r.pyRuleName as string) || "RuleForm",
      pyStreamName: (r.pyStreamName as string) || "RuleForm",
      pyLabel: (r.pyLabel as string) || undefined,
    }));
  }

  /** Classify error into phase based on message content */
  private classifyErrorPhase(err: any): SchemaError["phase"] {
    const msg = err.message || "";
    if (msg.includes("write") || msg.includes("ENOENT") || msg.includes("EACCES")) { return "write"; }
    if (msg.includes("Rule not found") || msg.includes("HTTP")) { return "fetch"; }
    return "parse";
  }

  /** Build final result object */
  private buildResult(
    total: number, unique: number, generated: number, failed: number, errors: SchemaError[],
  ): SchemaGenerationResult {
    return {
      totalHarnesses: total,
      uniqueRuleTypes: unique,
      schemasGenerated: generated,
      schemasFailed: failed,
      errors,
      outputDirectory: this.schemaWriter.getOutputDirectory(this.workspaceRoot),
    };
  }
}
