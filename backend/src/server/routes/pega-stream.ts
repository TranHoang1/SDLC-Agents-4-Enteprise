/**
 * NDJSON streaming ingest endpoint for Pega rules (SA4E-92).
 * Processes rules line-by-line with O(1) memory per rule — fixes OOM on large batches.
 * Protocol: first line = metadata JSON, subsequent lines = one rule JSON each.
 */

import { Hono } from 'hono';
import type { Logger } from 'pino';
import type { ModuleRegistry } from '../../modules/ModuleRegistry.js';
import { PegaService } from '../../modules/pega/PegaService.js';
import { PegaCrawler } from '../../modules/pega/PegaCrawler.js';
import { queryPegaTotals, registerPegaProject } from './pega-stream-helpers.js';

/** Metadata sent as the first NDJSON line */
interface StreamMetadata {
  __meta: true;
  projectId: string;
  checksums: Record<string, string>;
  versions: Record<string, string>;
  visitedKeys: string[];
}

/**
 * Create Hono routes for NDJSON streaming ingest.
 * @param registry - Module registry for accessing memory/PegaService
 * @param logger - Pino logger instance
 */
export function createPegaStreamRoutes(registry: ModuleRegistry, logger: Logger): Hono {
  const app = new Hono();

  /** Lazily resolve PegaService from memory module */
  const resolvePegaService = (): PegaService | null => {
    const memModule = registry.getModule('memory') as any;
    if (!memModule || memModule.status !== 'ready') return null;
    return new PegaService(memModule.getEngine());
  };

  app.post('/pega/ingest-stream', async (c) => {
    const service = resolvePegaService();
    if (!service) {
      return c.json({ data: null, error: { code: 'NOT_READY', message: 'Memory module not ready' } }, 503);
    }

    const reader = c.req.raw.body?.getReader();
    if (!reader) {
      return c.json({ data: null, error: { code: 'NO_BODY', message: 'Request body is empty' } }, 400);
    }

    try {
      const result = await processNdjsonStream(reader, service, logger);
      return c.json({ data: result, error: null });
    } catch (err: any) {
      logger.error({ err }, 'pega/ingest-stream failed');
      return c.json({ data: null, error: { code: 'STREAM_ERROR', message: err.message } }, 500);
    }
  });

  return app;
}

/**
 * Process the NDJSON stream line-by-line. Constant memory regardless of batch size.
 * @param reader - ReadableStream reader from the request body
 * @param service - PegaService for ingesting individual rules
 * @param logger - Logger for diagnostics
 */
async function processNdjsonStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  service: PegaService,
  logger: Logger,
): Promise<{
  stored: number;
  totalRulesInDb: number;
  totalKbEntriesInDb: number;
  totalGraphNodesInDb: number;
  nextBatch: Array<{ insKey: string; pxObjClass: string; pyClassName: string; pyRuleName: string }>;
}> {
  const decoder = new TextDecoder();
  let buffer = '';
  let meta: StreamMetadata | null = null;
  let stored = 0;
  const ingestedRules: Record<string, unknown>[] = [];

  // Read chunks from stream and split into lines
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Incomplete last line stays in buffer

    for (const line of lines) {
      if (!line.trim()) continue;
      const result = await processLine(line, meta, service, logger);
      if (result.isMeta) {
        meta = result.meta!;
      } else if (result.stored) {
        stored++;
        ingestedRules.push(result.rule!);
      }
    }
  }

  // Process remaining buffer content (last line without trailing newline)
  if (buffer.trim()) {
    const result = await processLine(buffer, meta, service, logger);
    if (result.stored) {
      stored++;
      ingestedRules.push(result.rule!);
    }
  }

  // Compute totals and next batch
  const totals = await queryPegaTotals(service, meta?.projectId || '');
  const crawler = new PegaCrawler();
  const visitedKeys = new Set(meta?.visitedKeys || []);
  const nextBatch = crawler.computeNextBatch(ingestedRules, visitedKeys, meta?.projectId || '');

  // Register project in project_registry
  if (meta) await registerPegaProject(service, meta.projectId, ingestedRules);

  logger.info({ stored, total: totals.totalRulesInDb }, '[pega-stream] Ingest complete');
  return { stored, ...totals, nextBatch };
}

/** Process a single NDJSON line — either metadata or a rule to ingest */
async function processLine(
  line: string,
  meta: StreamMetadata | null,
  service: PegaService,
  logger: Logger,
): Promise<{ isMeta: boolean; meta?: StreamMetadata; stored: boolean; rule?: Record<string, unknown> }> {
  const obj = JSON.parse(line);

  if (obj.__meta) {
    return { isMeta: true, meta: obj as StreamMetadata, stored: false };
  }

  if (!meta) {
    logger.warn('[pega-stream] Rule received before metadata line — skipping');
    return { isMeta: false, stored: false };
  }

  try {
    const sym = service.parseRuleToSymbol(obj);
    const checksum = sym ? meta.checksums[sym.fqn] : undefined;
    const version = sym ? meta.versions[sym.fqn] : undefined;

    const result = await service.ingestRule({
      projectId: meta.projectId,
      ruleJson: obj,
      checksum,
      version,
    });

    const didStore = result.status === 'success' && result.ruleId !== -1 && result.ruleId !== undefined;
    return { isMeta: false, stored: didStore, rule: didStore ? obj : undefined };
  } catch (err: any) {
    logger.debug({ err: err.message }, '[pega-stream] Single rule ingest failed — skipping');
    return { isMeta: false, stored: false };
  }
}
