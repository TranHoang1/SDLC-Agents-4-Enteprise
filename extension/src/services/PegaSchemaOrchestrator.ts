/**
 * SA4E-214 — PegaSchemaOrchestrator: Facade orchestrating recursive schema creation.
 * Extension-side: drives Pega harness/section fetching, delegates analysis to backend.
 * Implements mutex, circuit breaker, and total-timeout safety mechanisms.
 */

import type * as vscode from 'vscode';
import type { PegaHttpClient } from './PegaHttpClient';
import type { ISchemaCache } from './SchemaLocalCache';
import type { ISchemaApiClient } from './SchemaApiClient';
import type {
  EnrichedSchema,
  FieldDescriptor,
  SchemaAnalyzeResponse,
} from '../models/EnrichedSchema';

/** Interface for the schema orchestrator (TDD §5.2) */
export interface ISchemaOrchestrator {
  createSchema(ruleType: string): Promise<EnrichedSchema | null>;
  getSchema(ruleType: string): Promise<EnrichedSchema | null>;
  validateAndUpdate(ruleType: string, ruleJson: Record<string, unknown>): Promise<void>;
}

/** Config thresholds from extension settings (TDD §10.1) */
interface OrchestratorConfig {
  maxDepth: number;
  circuitBreakerThreshold: number;
  totalTimeoutMs: number;
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  maxDepth: 5,
  circuitBreakerThreshold: 20,
  totalTimeoutMs: 60_000,
};

/**
 * Orchestrates full schema creation: fetch harness → analyze → discover sub-sections → aggregate.
 * Pattern: Facade (single entry point), Mutex (prevent concurrent creation), Circuit Breaker.
 */
export class PegaSchemaOrchestrator implements ISchemaOrchestrator {
  private readonly creatingTypes = new Set<string>();
  private readonly config: OrchestratorConfig;

  constructor(
    private readonly cache: ISchemaCache,
    private readonly apiClient: ISchemaApiClient,
    private readonly pegaClient: PegaHttpClient,
    private readonly log: (msg: string) => void,
    config?: Partial<OrchestratorConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Create enriched schema for a rule type — async, non-blocking to BFS.
   * Returns null on failure (fail-safe: indexing continues regardless).
   */
  async createSchema(ruleType: string): Promise<EnrichedSchema | null> {
    // Mutex: skip if already creating this type
    if (this.creatingTypes.has(ruleType)) {
      this.log(`[Schema] ⏳ Already creating ${ruleType} — skipping`);
      return null;
    }

    // Check cache first
    const cached = this.cache.get(ruleType);
    if (cached) return cached;

    this.creatingTypes.add(ruleType);
    const startTime = Date.now();
    this.log(`[Schema] 🔧 Creating schema for ${ruleType}...`);

    try {
      const schema = await this.createWithTimeout(ruleType, startTime);
      if (schema) {
        this.cache.set(ruleType, schema);
        // Store in backend KB (fire-and-forget)
        this.apiClient.store(schema).catch(err =>
          this.log(`[Schema] ⚠️ KB store failed for ${ruleType}: ${err.message}`),
        );
        this.log(`[Schema] ✅ ${ruleType}: ${schema.known_fields.length} fields, ${schema.coverage}% coverage`);
      }
      return schema;
    } catch (err: any) {
      this.log(`[Schema] ❌ ${ruleType} failed: ${err.message}`);
      return null;
    } finally {
      this.creatingTypes.delete(ruleType);
    }
  }

  /** Get schema from cache or backend — does NOT trigger creation. */
  async getSchema(ruleType: string): Promise<EnrichedSchema | null> {
    const cached = this.cache.get(ruleType);
    if (cached) return cached;

    try {
      const remote = await this.apiClient.find(ruleType);
      if (remote) {
        this.cache.set(ruleType, remote);
        return remote;
      }
    } catch {
      // Non-fatal: backend may be unreachable
    }
    return null;
  }

  /** Progressive enrichment: compare rule JSON against schema, update if new fields found. */
  async validateAndUpdate(ruleType: string, ruleJson: Record<string, unknown>): Promise<void> {
    const schema = await this.getSchema(ruleType);
    if (!schema) return;

    const newFields = this.findNewFields(schema, ruleJson);
    if (newFields.length === 0) return;

    this.log(`[Schema] 📐 ${ruleType}: found ${newFields.length} new fields — updating`);
    try {
      const result = await this.apiClient.update(ruleType, newFields);
      // Update local cache version
      schema.schema_version = result.new_version;
      schema.known_fields.push(...newFields.map(f => f.path));
      schema.updated_at = new Date().toISOString();
      this.cache.set(ruleType, schema);
    } catch (err: any) {
      this.log(`[Schema] ⚠️ Progressive update failed for ${ruleType}: ${err.message}`);
    }
  }

  // ─── Private Implementation ─────────────────────────────────────────────

  /** Create schema with total-timeout enforcement (TDD §10.1: 60s). */
  private async createWithTimeout(ruleType: string, startTime: number): Promise<EnrichedSchema | null> {
    // Step 1: Fetch harness RuleForm from Pega
    const harnessJson = await this.fetchHarnessRuleForm(ruleType);
    if (!harnessJson) return null;

    this.checkTimeout(startTime, ruleType);

    // Step 2: Send to backend for analysis
    const analyzeResult = await this.apiClient.analyze({
      harnessJson,
      ruleType,
      depth: 0,
    });

    // Step 3: Recursive section discovery
    const allFields = [...analyzeResult.fields];
    const visited = new Set<string>();

    await this.recursiveDiscover(
      ruleType, analyzeResult.sub_sections, 1, visited, allFields, startTime,
    );

    // Step 4: Aggregate into EnrichedSchema
    return this.buildSchema(ruleType, allFields, analyzeResult, visited);
  }

  /** Recursively fetch and analyze sub-sections, accumulating fields. */
  private async recursiveDiscover(
    ruleType: string,
    sectionNames: string[],
    depth: number,
    visited: Set<string>,
    allFields: FieldDescriptor[],
    startTime: number,
  ): Promise<void> {
    if (depth > this.config.maxDepth) return;

    // Circuit breaker: >20 sections at one level → stop (TDD §5.3)
    if (sectionNames.length > this.config.circuitBreakerThreshold) {
      this.log(`[Schema] ⚡ Circuit breaker: ${sectionNames.length} sections at depth ${depth} for ${ruleType}`);
      return;
    }

    for (const sectionName of sectionNames) {
      if (visited.has(sectionName)) continue;
      visited.add(sectionName);

      this.checkTimeout(startTime, ruleType);

      const sectionJson = await this.fetchSection(sectionName);
      if (!sectionJson) continue;

      try {
        const result: SchemaAnalyzeResponse = await this.apiClient.analyze({
          harnessJson: sectionJson,
          ruleType,
          depth,
        });
        allFields.push(...result.fields);

        // Recurse into sub-sections
        if (result.sub_sections.length > 0) {
          await this.recursiveDiscover(
            ruleType, result.sub_sections, depth + 1, visited, allFields, startTime,
          );
        }
      } catch (err: any) {
        this.log(`[Schema] ⚠️ Section ${sectionName} analysis failed: ${err.message}`);
      }
    }
  }

  /** Fetch harness RuleForm JSON from Pega server via extension HTTP client. */
  private async fetchHarnessRuleForm(ruleType: string): Promise<Record<string, unknown> | null> {
    try {
      const harnessName = `${ruleType.replace(/^Rule-/, '')}RuleForm`;
      const result = await this.pegaClient.queryRuleByTriple(
        'Rule-HTML-Harness', ruleType, harnessName,
      );
      return result || null;
    } catch (err: any) {
      this.log(`[Schema] ⚠️ Harness fetch failed for ${ruleType}: ${err.message}`);
      return null;
    }
  }

  /** Fetch section JSON from Pega server. */
  private async fetchSection(sectionName: string): Promise<Record<string, unknown> | null> {
    try {
      const result = await this.pegaClient.queryRuleByTriple(
        'Rule-HTML-Section', '@baseclass', sectionName,
      );
      return result || null;
    } catch {
      return null;
    }
  }

  /** Build final EnrichedSchema from accumulated fields. */
  private buildSchema(
    ruleType: string,
    allFields: FieldDescriptor[],
    rootAnalysis: SchemaAnalyzeResponse,
    discoveredSections: Set<string>,
  ): EnrichedSchema {
    const now = new Date().toISOString();
    const identity: Record<string, FieldDescriptor> = {};
    const logic: Record<string, FieldDescriptor> = {};
    const connectivity: Record<string, FieldDescriptor> = {};

    // Categorize fields — deduplicate by path
    const seen = new Set<string>();
    for (const field of allFields) {
      if (seen.has(field.path)) continue;
      seen.add(field.path);
      switch (field.category) {
        case 'identity': identity[field.path] = field; break;
        case 'logic': logic[field.path] = field; break;
        case 'connectivity': connectivity[field.path] = field; break;
        default: logic[field.path] = field; break; // metadata/config → logic bucket
      }
    }

    return {
      rule_type: ruleType,
      schema_version: 1,
      created_at: now,
      updated_at: now,
      identity_fields: identity,
      logic_fields: logic,
      connectivity_fields: connectivity,
      extraction_hints: {
        primary_logic_field: rootAnalysis.hints.primary_logic_field || null,
        logic_structure: rootAnalysis.hints.logic_structure || null,
        summary_focus: rootAnalysis.hints.summary_focus || null,
      },
      known_fields: [...seen],
      coverage: rootAnalysis.rule_based_coverage,
      discovered_sections: [...discoveredSections],
    };
  }

  /** Compare rule JSON keys against schema known_fields to find new fields. */
  private findNewFields(schema: EnrichedSchema, ruleJson: Record<string, unknown>): FieldDescriptor[] {
    const knownSet = new Set(schema.known_fields);
    const newFields: FieldDescriptor[] = [];

    for (const key of Object.keys(ruleJson)) {
      // Skip internal Pega fields (px*/pz* prefix)
      if (key.startsWith('px') || key.startsWith('pz')) continue;
      if (knownSet.has(key)) continue;

      newFields.push({
        path: key,
        category: 'metadata',
        type: this.inferType(ruleJson[key]),
        description: `Discovered from instance (${typeof ruleJson[key]})`,
        frequency: 'rare',
      });
    }
    return newFields;
  }

  /** Infer JSON type string from a value. */
  private inferType(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  /** Throw if total timeout exceeded. */
  private checkTimeout(startTime: number, ruleType: string): void {
    if (Date.now() - startTime > this.config.totalTimeoutMs) {
      throw new Error(`Total timeout exceeded for ${ruleType} (${this.config.totalTimeoutMs}ms)`);
    }
  }
}
