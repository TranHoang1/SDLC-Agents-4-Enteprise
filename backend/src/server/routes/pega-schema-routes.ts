/**
 * SA4E-95 + SA4E-214 — Pega Schema Routes.
 * POST /pega/schema/generate — Backend parses harness JSON + section JSONs → returns JSON Schema.
 * POST /pega/schema/analyze  — Dual-strategy analysis (rule-based + LLM fallback)
 * POST /pega/schema/store    — Persist enriched schema in KB
 * GET  /pega/schema/find     — Retrieve enriched schema by rule type
 * PATCH /pega/schema/update  — Progressive field append
 * R-01: Body size limit enforced (5MB max).
 */

import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { Logger } from 'pino';
import { HarnessParser } from '../../modules/pega/harness-schema/parser/HarnessParser.js';
import { LlmSectionExtractor } from '../../modules/pega/harness-schema/parser/LlmSectionExtractor.js';
import { SchemaBuilder } from '../../modules/pega/harness-schema/generator/SchemaBuilder.js';
import { FormatTypeMapper } from '../../modules/pega/harness-schema/generator/FormatTypeMapper.js';
import { PageContextResolver } from '../../modules/pega/harness-schema/resolver/PageContextResolver.js';
import { ClassHierarchyResolver } from '../../modules/pega/harness-schema/resolver/ClassHierarchyResolver.js';
import { SchemaAnalyzeService } from '../../modules/pega/schema/SchemaAnalyzeService.js';
import { SchemaStorageService, SchemaNotFoundError, SchemaAlreadyExistsError } from '../../modules/pega/schema/SchemaStorageService.js';
import { SchemaAnalyzeRequestSchema, SchemaGenerateRequestSchema, SchemaStoreRequestSchema, SchemaUpdateRequestSchema } from '../../models/pega-schema.models.js';

/** Request body: extension sends raw harness + pre-fetched sections */
interface SchemaGenerateRequest {
  harnessJson: Record<string, unknown>;
  sectionJsons?: Record<string, Record<string, unknown>>;
  ruleType?: string;
}

/**
 * Create schema generation routes.
 * Backend does NOT talk to Pega — extension provides all raw JSON.
 * SA4E-214: Added analyze, store, find, update endpoints for enriched schemas.
 */
export function createPegaSchemaRoutes(logger: Logger, dbAdapter?: any): Hono {
  const app = new Hono();
  const formatMapper = new FormatTypeMapper();
  const schemaBuilder = new SchemaBuilder(formatMapper);
  const contextResolver = new PageContextResolver();

  // R-01: 5MB body size limit on all schema endpoints
  app.use('/*', bodyLimit({ maxSize: 5 * 1024 * 1024 }));

  // Wire up SA4E-214 services (lazy — only if dbAdapter available)
  let analyzeService: SchemaAnalyzeService | null = null;
  let storageService: SchemaStorageService | null = null;

  const ensureServices = () => {
    if (!analyzeService) {
      analyzeService = new SchemaAnalyzeService(logger, null); // LLM wired separately
    }
    if (!storageService && dbAdapter) {
      storageService = new SchemaStorageService(dbAdapter, logger);
    }
  };

  /**
   * POST /pega/schema/generate
   * Receives raw harness JSON + optional pre-fetched sections.
   * Returns generated JSON Schema.
   */
  app.post('/pega/schema/generate', async (c) => {
    const raw = await c.req.json();
    const parsed = SchemaGenerateRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({
        error: 'Invalid request',
        code: 'SCHEMA_INVALID_REQUEST',
        details: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
      }, 400);
    }

    const body = parsed.data as SchemaGenerateRequest;

    try {
      // Create a local hierarchy resolver that uses provided sections (no API calls)
      const localResolver = createLocalResolver(body.sectionJsons || {});

      // Wire LLM extractor if LLMService available (non-fatal if not)
      let llmExtractor: LlmSectionExtractor | undefined;
      try {
        const { LLMService } = await import('../../modules/memory/llm/LLMService.js');
        const { loadPersistedLLMConfig } = await import('../../admin/admin-db.js');
        const envConfig = {
          provider: (process.env.LLM_PROVIDER || 'lmstudio') as any,
          model: process.env.LLM_MODEL || 'qwen2.5-vl-7b-instruct',
          baseUrl: process.env.LLM_BASE_URL || 'http://localhost:1234/v1',
          apiKey: process.env.LLM_API_KEY || undefined,
          temperature: 0.2,
          maxTokens: 2000,
        };
        let llmConfig = envConfig;
        try {
          const dbOverrides = await loadPersistedLLMConfig();
          llmConfig = { ...envConfig, ...(dbOverrides.model && { model: dbOverrides.model }), ...(dbOverrides.baseUrl && { baseUrl: dbOverrides.baseUrl }) };
        } catch { /* use env config */ }
        const llmService = new LLMService(llmConfig);
        llmExtractor = new LlmSectionExtractor(llmService);
      } catch (err) {
        logger.debug({ err }, '[pega-schema] LLM not available — using rule-based only');
      }

      const parser = new HarnessParser(
        createNoOpFetcher(),
        localResolver,
        contextResolver,
        llmExtractor,
      );

      const parsedHarness = await parser.parse(body.harnessJson);
      const schema = schemaBuilder.build(parsedHarness);
      const coverage = schemaBuilder.calculateCoverage(parsedHarness);

      logger.info({
        ruleType: parsedHarness.ruleType,
        fieldCount: Object.keys(schema.properties).length,
        coverage,
      }, '[pega-schema] Schema generated');

      return c.json({
        schema,
        ruleType: parsedHarness.ruleType,
        coverage,
        templateSections: parsedHarness.templateMarkers.map(m => m.sectionName),
      });
    } catch (err: any) {
      logger.error({ err: err.message }, '[pega-schema] Generation failed');
      return c.json({
        error: 'Schema generation failed',
        ...(process.env.NODE_ENV !== 'production' && { details: err.message }),
      }, 500);
    }
  });

  // ─── SA4E-214: Enriched Schema Endpoints ──────────────────────────────────

  /**
   * POST /pega/schema/analyze — Dual-strategy analysis (TDD §3.2)
   * Receives harness/section JSON, returns fields + sub-sections.
   */
  app.post('/pega/schema/analyze', async (c) => {
    ensureServices();
    if (!analyzeService) {
      return c.json({ error: 'Analyze service unavailable' }, 503);
    }

    const raw = await c.req.json();
    const parsed = SchemaAnalyzeRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({
        error: 'Invalid request',
        code: 'SCHEMA_INVALID_REQUEST',
        details: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
      }, 400);
    }

    try {
      const result = await analyzeService.analyze(
        parsed.data.harnessJson,
        parsed.data.ruleType,
        parsed.data.depth,
      );
      return c.json(result);
    } catch (err: any) {
      if (err.message?.includes('timeout')) {
        return c.json({ error: 'LLM timeout', code: 'SCHEMA_LLM_TIMEOUT' }, 504);
      }
      logger.error({ err: err.message }, '[pega-schema] Analysis failed');
      return c.json({
        error: 'Analysis failed',
        code: 'SCHEMA_ANALYSIS_FAILED',
        ...(process.env.NODE_ENV !== 'production' && { details: err.message }),
      }, 500);
    }
  });

  /**
   * POST /pega/schema/store — Persist enriched schema (TDD §3.3)
   */
  app.post('/pega/schema/store', async (c) => {
    ensureServices();
    if (!storageService) {
      return c.json({ error: 'Storage service unavailable (no DB adapter)' }, 503);
    }

    const raw = await c.req.json();
    const parsed = SchemaStoreRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({
        error: 'Invalid schema',
        code: 'SCHEMA_INVALID_SCHEMA',
        details: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
      }, 400);
    }

    try {
      const id = await storageService.store(parsed.data.schema);
      return c.json({ success: true, id }, 201);
    } catch (err: any) {
      if (err instanceof SchemaAlreadyExistsError) {
        return c.json({ error: err.message, code: 'SCHEMA_ALREADY_EXISTS' }, 409);
      }
      logger.error({ err: err.message }, '[pega-schema] Store failed');
      return c.json({
        error: 'Store failed',
        ...(process.env.NODE_ENV !== 'production' && { details: err.message }),
      }, 500);
    }
  });

  /**
   * GET /pega/schema/find?ruleType=X — Retrieve schema (TDD §3.4)
   */
  app.get('/pega/schema/find', async (c) => {
    ensureServices();
    if (!storageService) {
      return c.json({ error: 'Storage service unavailable (no DB adapter)' }, 503);
    }

    const ruleType = c.req.query('ruleType');
    if (!ruleType || ruleType.length === 0) {
      return c.json({ error: 'Missing ruleType query parameter', code: 'SCHEMA_INVALID_REQUEST' }, 400);
    }

    const schema = await storageService.find(ruleType);
    if (!schema) {
      return c.json({ error: 'Schema not found for rule type', ruleType }, 404);
    }
    return c.json(schema);
  });

  /**
   * PATCH /pega/schema/update — Progressive field append (TDD §3.5)
   */
  app.patch('/pega/schema/update', async (c) => {
    ensureServices();
    if (!storageService) {
      return c.json({ error: 'Storage service unavailable (no DB adapter)' }, 503);
    }

    const raw = await c.req.json();
    const parsed = SchemaUpdateRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({
        error: 'Invalid update request',
        code: 'SCHEMA_EMPTY_UPDATE',
        details: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
      }, 400);
    }

    try {
      const newVersion = await storageService.update(parsed.data.ruleType, parsed.data.new_fields);
      return c.json({ success: true, new_version: newVersion });
    } catch (err: any) {
      if (err instanceof SchemaNotFoundError) {
        return c.json({ error: err.message, code: 'SCHEMA_NOT_FOUND' }, 404);
      }
      logger.error({ err: err.message }, '[pega-schema] Update failed');
      return c.json({
        error: 'Update failed',
        ...(process.env.NODE_ENV !== 'production' && { details: err.message }),
      }, 500);
    }
  });

  return app;
}

/** Create a resolver that looks up sections from provided map (no network calls) */
function createLocalResolver(
  sectionJsons: Record<string, Record<string, unknown>>,
): ClassHierarchyResolver {
  const resolver = Object.create(ClassHierarchyResolver.prototype) as ClassHierarchyResolver;
  (resolver as any).resolveSection = async (name: string, _targetClass: string) => {
    const json = sectionJsons[name];
    if (!json) return null;
    return { sectionJson: json, resolvedClass: (json.pyClassName as string) || '@baseclass' };
  };
  (resolver as any).getClassHierarchy = (_className: string) => ['@baseclass'];
  return resolver;
}

/** No-op fetcher since backend doesn't call Pega API */
function createNoOpFetcher(): any {
  return {
    fetchHarness: async () => null,
    fetchSection: async () => null,
  };
}
