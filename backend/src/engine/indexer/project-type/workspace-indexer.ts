/**
 * SA4E-108 — Project Type Workspace Integration (Hybrid Architecture).
 *
 * ARCHITECTURE:
 * - Extension detects project type locally (fast, filesystem access)
 * - Extension calls backend MCP tool `get_project_type_configs` if cache miss
 * - Extension sends detected type in indexing request
 * - Backend uses received type to resolve exclude/extension patterns
 *
 * This module provides:
 * 1. getProjectTypeConfigs() — serves KB configs to extension via MCP
 * 2. resolveFromDetectedType() — resolves strategy from extension-provided type
 * 3. cacheDetectionResult() — persists extension detection in DB
 */
import type { Logger } from 'pino';
import type { QueryDatabaseAdapter } from '../../../database/adapters/DatabaseAdapter.js';
import { ProjectTypeCache } from './cache.js';
import { IndexingStrategyResolver } from './resolver.js';
import { FALLBACK_TYPE, type DetectionResult, type IndexingConfig } from './models.js';

/** Resolve IndexingConfig from extension-provided detection result */
export function resolveFromDetectedType(detectionResult: DetectionResult): IndexingConfig {
  const resolver = new IndexingStrategyResolver();
  return detectionResult.project_type === FALLBACK_TYPE
    ? resolver.getFallback()
    : resolver.resolve(detectionResult);
}

/** Get all project type configs from KB (for extension via MCP tool) */
export async function getProjectTypeConfigs(
  kbSearch: (query: string, opts: { type: string; limit: number }) => Promise<{ content: string }[]>,
): Promise<string[]> {
  const results = await kbSearch('project-type-config', { type: 'ARCHITECTURE', limit: 50 });
  return results.map(r => r.content);
}

/** Cache extension's detection result into backend DB */
export async function cacheDetectionResult(
  db: QueryDatabaseAdapter,
  workspacePath: string,
  result: DetectionResult,
  logger: Logger,
): Promise<void> {
  const cache = new ProjectTypeCache(db);
  await cache.set(workspacePath, result);
  logger.info({ workspace: workspacePath, type: result.project_type }, 'Cached project type');
}
