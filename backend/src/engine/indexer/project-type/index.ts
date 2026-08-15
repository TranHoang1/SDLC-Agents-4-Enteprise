/**
 * SA4E-108 — Project Type Detection module barrel export.
 */
export { ProjectTypeDetector } from './detector.js';
export { IndexingStrategyResolver } from './resolver.js';
export { ProjectTypeCache } from './cache.js';
export { LLMDiscoveryService } from './discovery.js';
export { resolveFromDetectedType, getProjectTypeConfigs, cacheDetectionResult } from './workspace-indexer.js';
export { seedProjectTypes } from './seed.js';
export {
  type ProjectTypeConfig,
  type DetectionResult,
  type IndexingConfig,
  type SubProject,
  type ScoredMatch,
  ProjectTypeConfigSchema,
  SignalSchema,
  FALLBACK_TYPE,
} from './models.js';
