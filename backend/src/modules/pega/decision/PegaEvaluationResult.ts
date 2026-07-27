import type { PegValue } from '../expression/PegaExpressionAst.js';

export type DecisionOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'GREATER'
  | 'GREATER_EQUALS'
  | 'LESS'
  | 'LESS_EQUALS'
  | 'IN'
  | 'NOT_IN'
  | 'IS_NULL'
  | 'IS_BLANK'
  | 'CUSTOM';

export interface PegaDecisionCondition {
  field: string;
  operator: DecisionOperator;
  value: unknown;
}

export interface PegaDecisionTableRow {
  rowId: string;
  priority: number;
  conditions: PegaDecisionCondition[];
  result: unknown;
}

export interface DecisionTreeBranch {
  key: string;
  conditionResult: unknown;
  childNode: DecisionTreeNode | null;
}

export interface DecisionTreeNode {
  nodeId: string;
  condition: PegaDecisionCondition;
  branches: DecisionTreeBranch[];
  defaultResult?: unknown;
}

export interface PegaEvaluationResult {
  matchedRowId: string;
  outputValue: unknown;
  tracePath: string[];
  status: 'matched' | 'no_match' | 'error';
  error?: string;
}