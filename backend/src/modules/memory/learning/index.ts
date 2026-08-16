/**
 * SA4E-122: Continuous Learning v2 — module exports.
 */
export { PatternExtractor } from './PatternExtractor.js';
export { PatternClassifier } from './PatternClassifier.js';
export { SessionAnalyzer } from './SessionAnalyzer.js';
export { ClusteringService } from './ClusteringService.js';
export type {
  PatternType,
  ExtractedPattern,
  LearningResult,
  IngestedPattern,
  LearningConfig,
} from './types.js';
export { DEFAULT_LEARNING_CONFIG } from './types.js';
