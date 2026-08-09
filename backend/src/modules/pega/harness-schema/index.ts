/**
 * SA4E-95 - Pega Harness Schema Generator public API.
 * Pipeline: Fetch -> Parse -> Resolve -> Generate JSON Schema from RuleForm harnesses.
 */

// Models
export type {
  ParsedHarness,
  PageContext,
  HarnessMetadata,
} from './models/ParsedHarness.js';
export type { ParsedSection, BodyType } from './models/ParsedSection.js';
export type { ExtractedField } from './models/ExtractedField.js';
export type { ResolvedContext, ContextSource } from './models/ResolvedContext.js';
export type { RepeatDefinition } from './models/RepeatDefinition.js';
export type { TemplateMarker } from './models/TemplateMarker.js';
export type { CacheManifest, CacheEntry } from './models/CacheManifest.js';
export type {
  GenerationReport,
  GeneratedSchema,
  SchemaDetail,
} from './models/GenerationReport.js';

// Fetcher
export { HarnessFetcher } from './fetcher/HarnessFetcher.js';
export type { PegaApiConfig, ListRulesResult } from './fetcher/HarnessFetcher.js';

// Parser
export { HarnessParser } from './parser/HarnessParser.js';
export type { IHarnessParser } from './parser/HarnessParser.js';
export { FieldExtractor } from './parser/FieldExtractor.js';

// Resolvers
export { PageContextResolver } from './resolver/PageContextResolver.js';
export type { IPageContextResolver } from './resolver/PageContextResolver.js';
export { ClassHierarchyResolver } from './resolver/ClassHierarchyResolver.js';
export type { IClassHierarchyResolver, ResolvedSection } from './resolver/ClassHierarchyResolver.js';

// Generator
export { SchemaBuilder } from './generator/SchemaBuilder.js';
export type { JSONSchema2020 } from './generator/SchemaBuilder.js';
export { FormatTypeMapper } from './generator/FormatTypeMapper.js';
export type { SchemaTypeDefinition } from './generator/FormatTypeMapper.js';
export { ReportBuilder } from './generator/ReportBuilder.js';

// Validator
export { SchemaValidator } from './validator/SchemaValidator.js';
export type {
  ISchemaValidator,
  ValidationResult,
  ValidationError,
} from './validator/SchemaValidator.js';

// Cache
export { SchemaCacheManager } from './cache/SchemaCacheManager.js';

// Orchestrator
export { HarnessSchemaGenerator } from './HarnessSchemaGenerator.js';
export type {
  IHarnessSchemaGenerator,
  GeneratorConfig,
  PipelineState,
} from './HarnessSchemaGenerator.js';
