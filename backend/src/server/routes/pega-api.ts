/**
 * Pega API Routes — Check rule, Ingest rule, Get schemas, Upsert schema, Browser plan, Crawl, Project detect.
 */

import { Hono } from 'hono';
import type { Logger } from 'pino';
import type { ModuleRegistry } from '../../modules/ModuleRegistry.js';
import type {
  PegaCheckRuleRequest,
  PegaIngestRuleRequest,
  PegaCrawlPlanRequest,
  PegaCrawlBatchRequest,
  PegaDetectProjectRequest,
} from '../../modules/pega/models.js';
import { PegaService } from '../../modules/pega/PegaService.js';
import { PegaActionPlanGenerator } from '../../modules/pega/PegaActionPlanGenerator.js';
import { PegaCrawler } from '../../modules/pega/PegaCrawler.js';
import { PegaProjectDetector } from '../../modules/pega/PegaProjectDetector.js';
import type { PegaRuleKbSchema } from '../../modules/pega/strategies/KbDrivenPegaParserStrategy.js';
import { PegaExpressionEvaluator } from '../../modules/pega/expression/PegaExpressionEvaluator.js';
import { PegaClipboardContext } from '../../modules/pega/expression/PegaClipboardContext.js';
import { PegaWhenEvaluator } from '../../modules/pega/expression/PegaWhenEvaluator.js';
import { PegaConstraintEvaluator } from '../../modules/pega/expression/PegaConstraintEvaluator.js';
import { PegaFlowGraphBuilder } from '../../modules/pega/workflow/PegaFlowGraphBuilder.js';
import { PegaWorkflowEngine } from '../../modules/pega/workflow/PegaWorkflowEngine.js';
import { PegaEvaluationSandbox } from '../../modules/pega/security/PegaEvaluationSandbox.js';
import { PegaExpressionValidator } from '../../modules/pega/security/PegaExpressionValidator.js';
import { PegaEvaluationCache } from '../../modules/pega/deploy/PegaEvaluationCache.js';

export function createPegaApiRoutes(registry: ModuleRegistry, logger: Logger): Hono {
  const app = new Hono();

  const getPegaService = (): PegaService | null => {
    const memModule = registry.getModule('memory') as any;
    if (!memModule || memModule.status !== 'ready') return null;
    return new PegaService(memModule.getEngine());
  };

  app.post('/pega/check-rule', async (c) => {
    const service = getPegaService();
    if (!service) return c.json({ error: { code: 'NOT_READY', message: 'Memory module not ready' } }, 503);
    try {
      const body = await c.req.json<PegaCheckRuleRequest>();
      return c.json({ data: await service.checkRule(body), error: null });
    } catch (err: any) {
      logger.error({ err }, 'pega/check-rule failed');
      return c.json({ data: null, error: { code: 'INTERNAL_ERROR', message: err.message } }, 500);
    }
  });

  app.post('/pega/ingest-rule', async (c) => {
    const service = getPegaService();
    if (!service) return c.json({ error: { code: 'NOT_READY', message: 'Memory module not ready' } }, 503);
    try {
      const body = await c.req.json<PegaIngestRuleRequest>();
      return c.json({ data: await service.ingestRule(body), error: null }, 201);
    } catch (err: any) {
      logger.error({ err }, 'pega/ingest-rule failed');
      return c.json({ data: null, error: { code: 'INTERNAL_ERROR', message: err.message } }, 500);
    }
  });

  app.get('/pega/schemas', async (c) => {
    const service = getPegaService();
    if (!service) return c.json({ error: { code: 'NOT_READY', message: 'Memory module not ready' } }, 503);
    return c.json({ data: await service.getSchemasFromDb(), error: null });
  });

  app.post('/pega/schemas', async (c) => {
    const service = getPegaService();
    if (!service) return c.json({ error: { code: 'NOT_READY', message: 'Memory module not ready' } }, 503);
    try {
      const schema = await c.req.json<PegaRuleKbSchema>();
      await service.upsertSchemaInDb(schema);
      return c.json({ data: { success: true, targetClass: schema.targetClass }, error: null }, 201);
    } catch (err: any) {
      logger.error({ err }, 'pega/schemas upsert failed');
      return c.json({ data: null, error: { code: 'INTERNAL_ERROR', message: err.message } }, 500);
    }
  });

  app.post('/pega/ast-parse', async (c) => {
    try {
      const body = await c.req.json<{ ruleJson: Record<string, unknown> }>();
      const service = getPegaService();
      if (!service) return c.json({ error: { code: 'NOT_READY', message: 'Memory module not ready' } }, 503);
      const ast = service.parseRuleToAst(body.ruleJson);
      return c.json({ data: ast, error: null });
    } catch (err: any) {
      logger.error({ err }, 'pega/ast-parse failed');
      return c.json({ data: null, error: { code: 'INTERNAL_ERROR', message: err.message } }, 500);
    }
  });

  app.post('/pega/ast-prompt', async (c) => {
    try {
      const body = await c.req.json<{ ruleJson: Record<string, unknown> }>();
      const service = getPegaService();
      if (!service) return c.json({ error: { code: 'NOT_READY', message: 'Memory module not ready' } }, 503);
      const ctx = service.ruleToPromptContext(body.ruleJson);
      return c.json({ data: { context: ctx }, error: null });
    } catch (err: any) {
      logger.error({ err }, 'pega/ast-prompt failed');
      return c.json({ data: null, error: { code: 'INTERNAL_ERROR', message: err.message } }, 500);
    }
  });

  app.post('/pega/browser-plan', async (c) => {
    try {
      const body = await c.req.json<{ ruleJson: Record<string, unknown> }>();
      const plan = PegaActionPlanGenerator.generatePlan(body.ruleJson);
      return c.json({ data: plan, error: null });
    } catch (err: any) {
      logger.error({ err }, 'pega/browser-plan failed');
      return c.json({ data: null, error: { code: 'INTERNAL_ERROR', message: err.message } }, 500);
    }
  });

  app.post('/pega/crawl-plan', async (c) => {
    const service = getPegaService();
    if (!service) return c.json({ error: { code: 'NOT_READY', message: 'Memory module not ready' } }, 503);
    try {
      const body = await c.req.json<PegaCrawlPlanRequest>();
      const crawler = new PegaCrawler();
      const visitedKeys = new Set(body.visitedKeys || []);
      const plan = crawler.plan(body.ruleKeys, visitedKeys);
      return c.json({ data: plan, error: null });
    } catch (err: any) {
      logger.error({ err }, 'pega/crawl-plan failed');
      return c.json({ data: null, error: { code: 'INTERNAL_ERROR', message: err.message } }, 500);
    }
  });

  app.post('/pega/crawl-batch', async (c) => {
    const service = getPegaService();
    if (!service) return c.json({ error: { code: 'NOT_READY', message: 'Memory module not ready' } }, 503);
    try {
      const body = await c.req.json<PegaCrawlBatchRequest>();
      const crawler = new PegaCrawler();
      const visitedKeys = new Set(body.visitedKeys || []);

      let stored = 0;
      for (const rule of body.rules) {
        try {
          await service.ingestRule({
            projectId: body.projectId,
            ruleJson: rule,
          });
          stored++;
        } catch { /* skip individual failures */ }
      }

      let totalRulesInDb = stored;
      let totalKbEntriesInDb = stored * 2;
      let totalGraphNodesInDb = stored;
      try {
        const adapter = (service as any).memoryEngine.getAdapter();
        const rowRules = (await adapter.getAsync(
          "SELECT COUNT(DISTINCT source) as cnt FROM knowledge_entries WHERE project_id = $1 AND type IN ('PEGA_RULE', 'PEGA_DATA')",
          [body.projectId]
        )) as { cnt?: number } | undefined;
        if (rowRules && typeof rowRules.cnt === 'number') { totalRulesInDb = Number(rowRules.cnt); }

        const rowKb = (await adapter.getAsync(
          "SELECT COUNT(*) as cnt FROM knowledge_entries WHERE project_id = $1",
          [body.projectId]
        )) as { cnt?: number } | undefined;
        if (rowKb && typeof rowKb.cnt === 'number') { totalKbEntriesInDb = Number(rowKb.cnt); }

        const rowGraph = (await adapter.getAsync(
          "SELECT COUNT(*) as cnt FROM graph_nodes WHERE project_id = $1",
          [body.projectId]
        )) as { cnt?: number } | undefined;
        if (rowGraph && typeof rowGraph.cnt === 'number') { totalGraphNodesInDb = Number(rowGraph.cnt); }
      } catch { /* fallback */ }

      const nextBatch = crawler.computeNextBatch(body.rules, visitedKeys, body.projectId);
      return c.json({ data: { stored, totalRulesInDb, totalKbEntriesInDb, totalGraphNodesInDb, nextBatch }, error: null });
    } catch (err: any) {
      logger.error({ err }, 'pega/crawl-batch failed');
      return c.json({ data: null, error: { code: 'INTERNAL_ERROR', message: err.message } }, 500);
    }
  });

  app.post('/pega/detect-project', async (c) => {
    try {
      const body = await c.req.json<PegaDetectProjectRequest>();
      const info = PegaProjectDetector.detect(body.workspaceRoot);
      return c.json({ data: info, error: null });
    } catch (err: any) {
      logger.error({ err }, 'pega/detect-project failed');
      return c.json({ data: null, error: { code: 'INTERNAL_ERROR', message: err.message } }, 500);
    }
  });

  // L3-L4 endpoints

  const evalCache = new PegaEvaluationCache();

  app.post('/pega/evaluate-expression', async (c) => {
    try {
      const body = await c.req.json<{
        expression: string;
        clipboard?: Record<string, Record<string, unknown>>;
        currentPage?: string;
        timeout?: number;
      }>();

      const validator = new PegaExpressionValidator();
      const validation = validator.validate(body.expression);
      if (!validation.valid) {
        return c.json({ data: null, error: { code: validation.errors[0].code, message: validation.errors[0].message } }, 400);
      }

      const cacheKey = `${body.expression}:${JSON.stringify(body.clipboard || {})}`;
      const cached = evalCache.get(cacheKey);
      if (cached) return c.json({ data: cached, error: null });

      const sandbox = new PegaEvaluationSandbox({ timeoutMs: body.timeout ?? 5000 });
      const result = await sandbox.evaluate({
        expression: body.expression,
        clipboard: body.clipboard || {},
        currentPage: body.currentPage,
      });

      evalCache.set(cacheKey, result);
      return c.json({ data: result, error: null });
    } catch (err: any) {
      logger.error({ err }, 'pega/evaluate-expression failed');
      const status = err.code === 'PARSE_ERROR' || err.code === 'PROPERTY_NOT_FOUND' || err.code === 'FUNCTION_NOT_ALLOWED' ? 400 : 500;
      return c.json({ data: null, error: { code: err.code || 'INTERNAL_ERROR', message: err.message } }, status);
    }
  });

  app.post('/pega/evaluate-when', async (c) => {
    try {
      const body = await c.req.json<{
        expression: string;
        clipboard?: Record<string, Record<string, unknown>>;
        currentPage?: string;
      }>();

      const ctx = new PegaClipboardContext(body.clipboard || {}, body.currentPage);
      const whenEval = new PegaWhenEvaluator();
      const result = whenEval.evaluateWhen(body.expression, ctx);

      return c.json({ data: result, error: null });
    } catch (err: any) {
      logger.error({ err }, 'pega/evaluate-when failed');
      return c.json({ data: null, error: { code: 'INTERNAL_ERROR', message: err.message } }, 500);
    }
  });

  app.post('/pega/evaluate-constraints', async (c) => {
    try {
      const body = await c.req.json<{
        constraints: Array<{ targetProperty: string; expression: string; label?: string; enabled?: boolean }>;
        clipboard?: Record<string, Record<string, unknown>>;
        currentPage?: string;
      }>();

      const ctx = new PegaClipboardContext(body.clipboard || {}, body.currentPage);
      const constraintEval = new PegaConstraintEvaluator();
      const result = constraintEval.evaluateConstraints(body.constraints, ctx);

      return c.json({ data: result, error: null });
    } catch (err: any) {
      logger.error({ err }, 'pega/evaluate-constraints failed');
      return c.json({ data: null, error: { code: 'INTERNAL_ERROR', message: err.message } }, 500);
    }
  });

  app.post('/pega/simulate-flow', async (c) => {
    try {
      const body = await c.req.json<{
        flowJson: { pyShapes?: Record<string, unknown>[]; shapes?: Record<string, unknown>[]; pyConnectors?: Record<string, unknown>[]; connectors?: Record<string, unknown>[] };
        initialClipboard?: Record<string, Record<string, unknown>>;
        startShapeId?: string;
      }>();

      const shapes = body.flowJson.pyShapes || body.flowJson.shapes || [];
      const connectors = body.flowJson.pyConnectors || body.flowJson.connectors || [];

      const builder = new PegaFlowGraphBuilder();
      const graph = builder.build(shapes, connectors);

      const ctx = new PegaClipboardContext(body.initialClipboard || {});

      const engine = new PegaWorkflowEngine();
      const result = engine.simulate(graph, ctx, body.startShapeId);

      return c.json({ data: result, error: null });
    } catch (err: any) {
      logger.error({ err }, 'pega/simulate-flow failed');
      return c.json({ data: null, error: { code: 'INTERNAL_ERROR', message: err.message } }, 500);
    }
  });

  app.get('/pega/health', async (c) => {
    return c.json({
      data: {
        status: 'ok',
        cacheSize: evalCache.size,
        modules: {
          expression: true,
          workflow: true,
          constraints: true,
          when: true,
          validation: true,
          sandbox: true,
          cache: true,
        },
      },
      error: null,
    });
  });

  app.post('/pega/fetch-rule', async (c) => {
    try {
      const body = await c.req.json<{
        pxObjClass: string;
        pyRuleName: string;
        insKey?: string;
        pegaEndpoint?: string;
        authHeader?: string;
        username?: string;
        password?: string;
      }>();

      const { PegaRuleFetcherService } = await import('../../modules/pega/PegaRuleFetcherService.js');
      const fetcher = new PegaRuleFetcherService();
      const res = await fetcher.fetchRule({
        pxObjClass: body.pxObjClass,
        pyRuleName: body.pyRuleName,
        insKey: body.insKey,
        pegaEndpoint: body.pegaEndpoint || 'https://9ucseukj.pegaacademy.net/prweb',
        authHeader: body.authHeader,
        username: body.username || 'SSA@TGB',
        password: body.password || 'pega123!',
      });

      return c.json({ data: res, error: null });
    } catch (err: any) {
      logger.error({ err }, 'pega/fetch-rule failed');
      return c.json({ data: null, error: { code: 'INTERNAL_ERROR', message: err.message } }, 500);
    }
  });

  return app;
}
