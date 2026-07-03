/**
 * KSA-161: Complexity Analyzer — Type definitions.
 */

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface DecisionPointCounts {
  branches: number;
  loops: number;
  logical_ops: number;
  exception_handlers: number;
}

export interface ComplexityBreakdown extends DecisionPointCounts {
  cyclomatic_complexity: number;
  nesting_depth: number;
  early_returns: number;
}

export interface ComplexityResult extends ComplexityBreakdown {
  symbol_id: number;
  symbol_name: string;
  file_path: string;
  start_line: number;
  end_line: number;
  grade: Grade;
}

export interface FileComplexityResult {
  file_path: string;
  functions: ComplexityResult[];
  average_complexity: number;
  max_complexity: number;
  total_functions: number;
}

export interface ComplexityFilters {
  filePath?: string;
  symbolName?: string;
  minComplexity?: number;
  gradeFilter?: Grade[];
  module?: string;
  limit: number;
  sortBy: 'complexity' | 'name' | 'file';
}

export interface ComplexityQueryResult {
  results: ComplexityResult[];
  total: number;
  summary: {
    average: number;
    gradeDistribution: Record<Grade, number>;
  };
}

export interface GradeThresholds {
  A: number; // max CC for grade A (default: 5)
  B: number; // max CC for grade B (default: 10)
  C: number; // max CC for grade C (default: 20)
  D: number; // max CC for grade D (default: 50)
  // F: anything above D threshold
}
