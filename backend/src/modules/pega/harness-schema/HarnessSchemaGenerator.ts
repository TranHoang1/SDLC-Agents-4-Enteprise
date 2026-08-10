/**
 * SA4E-95 - HarnessSchemaGenerator: pipeline orchestrator for harness-to-schema generation.
 * Coordinates: Fetcher -> Parser -> Resolver -> Generator stages.
 * Pipeline states: IDLE -> FETCHING -> PARSING -> GENERATING -> COMPLETE.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { HarnessFetcher } from './fetcher/HarnessFetcher.js';
import type { HarnessParser } from './parser/HarnessParser.js';
import { SchemaBuilder } from './generator/SchemaBuilder.js';
import { FormatTypeMapper } from './generator/FormatTypeMapper.js';
import { ReportBuilder } from './generator/ReportBuilder.js';
import type { SchemaCacheManager } from './cache/SchemaCacheManager.js';
import type { GeneratedSchema, GenerationReport, SchemaDetail } from './models/GenerationReport.js';

/** Pipeline state for observability */
export type PipelineState = 'IDLE' | 'FETCHING' | 'PARSING' | 'GENERATING' | 'COMPLETE' | 'ERROR';

/** Orchestrator configuration */
export interface GeneratorConfig {
  outputDir: string;
  maxConcurrent?: number;
  cacheEnabled?: boolean;
}

/** Interface for the orchestrator */
export interface IHarnessSchemaGenerator {
  generateForRuleType(ruleType: string): Promise<GeneratedSchema>;
  generateAll(ruleTypes: string[]): Promise<GenerationReport>;
  generateIncremental(ruleTypes: string[]): Promise<GenerationReport>;
}

/**
 * Orchestrates the full schema generation pipeline for one or more rule types.
 * Each rule type: Fetch -> Parse -> Build -> Write.
 */
export class HarnessSchemaGenerator implements IHarnessSchemaGenerator {
  private state: PipelineState = 'IDLE';
  private readonly schemaBuilder: SchemaBuilder;
  private readonly reportBuilder = new ReportBuilder();

  constructor(
    private readonly fetcher: HarnessFetcher,
    private readonly parser: HarnessParser,
    private readonly cacheManager: SchemaCacheManager,
    private readonly config: GeneratorConfig
  ) {
    this.schemaBuilder = new SchemaBuilder(new FormatTypeMapper());
  }

  /** Get current pipeline state */
  getState(): PipelineState { return this.state; }

  /** Generate schema for a single rule type */
  async generateForRuleType(ruleType: string): Promise<GeneratedSchema> {
    this.state = 'FETCHING';
    const harnessJson = await this.fetcher.fetchHarness(ruleType);
    if (!harnessJson) throw new Error(`No harness found for: ${ruleType}`);

    this.state = 'PARSING';
    const parsedHarness = await this.parser.parse(harnessJson);

    this.state = 'GENERATING';
    const schema = this.schemaBuilder.build(parsedHarness);
    const coverage = this.schemaBuilder.calculateCoverage(parsedHarness);
    const schemaContent = JSON.stringify(schema, null, 2);

    this.writeSchemaFile(ruleType, schemaContent);
    const version = this.cacheManager.computeSchemaHash(schemaContent);
    this.updateCache(ruleType, parsedHarness.metadata, version);

    this.state = 'COMPLETE';
    return {
      ruleType, schema: schema as unknown as Record<string, unknown>,
      coverage, templateSections: parsedHarness.templateMarkers.map((m) => m.sectionName),
      version,
    };
  }

  /** Generate schemas for all specified rule types */
  async generateAll(ruleTypes: string[]): Promise<GenerationReport> {
    const startTime = Date.now();
    const details: SchemaDetail[] = [];
    for (const ruleType of ruleTypes) {
      details.push(await this.generateSingle(ruleType));
    }
    this.state = 'COMPLETE';
    return this.reportBuilder.build(details, startTime);
  }

  /** Generate only changed schemas (incremental mode) */
  async generateIncremental(ruleTypes: string[]): Promise<GenerationReport> {
    const startTime = Date.now();
    const details: SchemaDetail[] = [];
    for (const ruleType of ruleTypes) {
      if (this.config.cacheEnabled && !this.isCacheStale(ruleType)) {
        details.push(this.reportBuilder.skippedDetail(ruleType, 0));
      } else {
        details.push(await this.generateSingle(ruleType));
      }
    }
    this.state = 'COMPLETE';
    return this.reportBuilder.build(details, startTime);
  }

  /** Generate a single rule type, returning a SchemaDetail */
  private async generateSingle(ruleType: string): Promise<SchemaDetail> {
    const start = Date.now();
    try {
      const result = await this.generateForRuleType(ruleType);
      const fieldCount = this.countFields(result.schema);
      return this.reportBuilder.successDetail(
        ruleType, result.coverage, fieldCount, result.templateSections, Date.now() - start
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return this.reportBuilder.failureDetail(ruleType, msg, Date.now() - start);
    }
  }

  /** Write schema JSON to output directory */
  private writeSchemaFile(ruleType: string, content: string): void {
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }
    const filePath = path.join(this.config.outputDir, `${ruleType}.schema.json`);
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  /** Update cache manifest after successful generation */
  private updateCache(
    ruleType: string, metadata: { insKey: string; updateDateTime: string }, version: string
  ): void {
    if (!this.config.cacheEnabled) return;
    this.cacheManager.updateEntry({
      ruleType, harnessInsKey: metadata.insKey,
      updateDateTime: metadata.updateDateTime,
      schemaHash: version, schemaPath: `${ruleType}.schema.json`,
    });
  }

  /** Check if cache entry is stale */
  private isCacheStale(ruleType: string): boolean {
    return !this.cacheManager.getEntry(ruleType);
  }

  /** Count properties in generated schema */
  private countFields(schema: Record<string, unknown>): number {
    const props = schema.properties as Record<string, unknown> | undefined;
    return props ? Object.keys(props).length : 0;
  }
}
