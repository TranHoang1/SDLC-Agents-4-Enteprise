/**
 * SA4E-95 — Pega Schema Generation Routes.
 * POST /pega/schema/generate — Backend parses harness JSON + section JSONs → returns JSON Schema.
 * Architecture: Extension fetches from Pega, backend only does analysis.
 */

import { Hono } from 'hono';
import type { Logger } from 'pino';
import { HarnessParser } from '../../modules/pega/harness-schema/parser/HarnessParser.js';
import { SchemaBuilder } from '../../modules/pega/harness-schema/generator/SchemaBuilder.js';
import { FormatTypeMapper } from '../../modules/pega/harness-schema/generator/FormatTypeMapper.js';
import { PageContextResolver } from '../../modules/pega/harness-schema/resolver/PageContextResolver.js';
import { ClassHierarchyResolver } from '../../modules/pega/harness-schema/resolver/ClassHierarchyResolver.js';

/** Request body: extension sends raw harness + pre-fetched sections */
interface SchemaGenerateRequest {
  harnessJson: Record<string, unknown>;
  sectionJsons?: Record<string, Record<string, unknown>>;
  ruleType?: string;
}

/**
 * Create schema generation routes.
 * Backend does NOT talk to Pega — extension provides all raw JSON.
 */
export function createPegaSchemaRoutes(logger: Logger): Hono {
  const app = new Hono();
  const formatMapper = new FormatTypeMapper();
  const schemaBuilder = new SchemaBuilder(formatMapper);
  const contextResolver = new PageContextResolver();

  /**
   * POST /pega/schema/generate
   * Receives raw harness JSON + optional pre-fetched sections.
   * Returns generated JSON Schema.
   */
  app.post('/pega/schema/generate', async (c) => {
    const body = await c.req.json<SchemaGenerateRequest>();

    if (!body.harnessJson) {
      return c.json({ error: 'Missing harnessJson in request body' }, 400);
    }

    try {
      // Create a local hierarchy resolver that uses provided sections (no API calls)
      const localResolver = createLocalResolver(body.sectionJsons || {});
      const parser = new HarnessParser(
        createNoOpFetcher(),
        localResolver,
        contextResolver,
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
        details: err.message,
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
