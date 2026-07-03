/**
 * KSA-163: Graph Analysis — Type definitions.
 */

export interface CircularDep {
  cycle: CycleChain;
  length: number;
  severity: 'high' | 'medium' | 'low';
  module?: string;
}

export interface CycleChain {
  nodes: CycleNode[];
  edges: string[]; // "A → B → C → A"
}

export interface CycleNode {
  symbolId: number;
  name: string;
  filePath: string;
  kind: string;
}

export interface RelatedTestResult {
  symbol: { id: number; name: string; filePath: string };
  directTests: TestReference[];
  indirectTests: TestReference[];
  totalTests: number;
}

export interface TestReference {
  symbolId: number;
  testName: string;
  filePath: string;
  depth: number;
  path: string[]; // call chain from test to target
}

export interface CallerPath {
  symbolId: number;
  symbolName: string;
  filePath: string;
  depth: number;
  path: number[];
}

export interface HotPath {
  symbolId: number;
  symbolName: string;
  filePath: string;
  directCallers: number;
  transitiveCallers: number;
  kind: string;
}

export interface DeadImport {
  filePath: string;
  line: number;
  importedSymbol: string;
  fromModule: string;
}

export interface ModuleSummary {
  module: string;
  fileCount: number;
  symbolCount: number;
  circularDeps: number;
  hotPaths: HotPath[];
  deadImports: number;
  avgComplexity: number | null;
}

export type AdjacencyList = Map<number, number[]>;
