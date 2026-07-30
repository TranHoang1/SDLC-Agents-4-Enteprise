import type { PegaDecisionCondition, DecisionOperator } from './PegaEvaluationResult.js';

const OPERATOR_MAP: Record<string, DecisionOperator> = {
  equals: 'EQUALS',
  equal: 'EQUALS',
  '=': 'EQUALS',
  notEqual: 'NOT_EQUALS',
  notEquals: 'NOT_EQUALS',
  '<>': 'NOT_EQUALS',
  '!=': 'NOT_EQUALS',
  greaterThan: 'GREATER',
  '>': 'GREATER',
  greaterOrEqual: 'GREATER_EQUALS',
  greaterEquals: 'GREATER_EQUALS',
  '>=': 'GREATER_EQUALS',
  lessThan: 'LESS',
  '<': 'LESS',
  lessOrEqual: 'LESS_EQUALS',
  lessEquals: 'LESS_EQUALS',
  '<=': 'LESS_EQUALS',
  in: 'IN',
  notIn: 'NOT_IN',
  not_in: 'NOT_IN',
  isNull: 'IS_NULL',
  is_null: 'IS_NULL',
  isBlank: 'IS_BLANK',
  is_blank: 'IS_BLANK',
  custom: 'CUSTOM',
};

export function parseDecisionCondition(raw: Record<string, unknown>): PegaDecisionCondition {
  const rawOp = String(raw.operator ?? '');
  const operator = normalizeOperator(rawOp);

  return {
    field: String(raw.field ?? ''),
    operator,
    value: raw.value,
  };
}

function normalizeOperator(raw: string): DecisionOperator {
  const trimmed = raw.trim().toLowerCase();
  const mapped = OPERATOR_MAP[trimmed];
  if (mapped) return mapped;

  if (trimmed.startsWith('custom') || trimmed.startsWith('@')) {
    return 'CUSTOM';
  }

  return 'EQUALS';
}