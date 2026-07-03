/**
 * KSA-163: Graph Analysis Module — Circular deps, related tests, hot paths.
 */

export { CircularDepDetector } from './CircularDepDetector.js';
export { RelatedTestFinder } from './RelatedTestFinder.js';
export { HotPathAnalyzer } from './HotPathAnalyzer.js';
export { DeadImportDetector } from './DeadImportDetector.js';
export { ModuleSummarizer } from './ModuleSummarizer.js';
export { GraphLoader } from './utils/GraphLoader.js';
export { TarjanSCC } from './utils/TarjanSCC.js';
export { TestFileDetector } from './utils/TestFileDetector.js';
export { GRAPH_ANALYSIS_TOOL_DEFINITIONS, handleGraphAnalysisTool } from './GraphAnalysisTools.js';

export type {
  CircularDep,
  CycleChain,
  RelatedTestResult,
  CallerPath,
  HotPath,
  DeadImport,
  ModuleSummary,
} from './types.js';
