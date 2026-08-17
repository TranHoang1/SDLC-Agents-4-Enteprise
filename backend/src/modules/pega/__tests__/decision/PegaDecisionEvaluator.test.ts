import { describe, it, expect } from 'vitest';
import { PegaConditionOperatorRegistry } from '../../decision/PegaConditionOperatorRegistry.js';
import { parseDecisionCondition } from '../../decision/PegaDecisionConditionParser.js';
import { PegaDecisionTableEvaluator } from '../../decision/PegaDecisionTableEvaluator.js';
import { PegaDecisionTreeEvaluator } from '../../decision/PegaDecisionTreeEvaluator.js';
import { PegaStrategyComponentResolver } from '../../decision/PegaStrategyComponentResolver.js';
import { resolveFieldValue } from '../../decision/fieldResolver.js';
import { PegaClipboardContext } from '../../expression/PegaClipboardContext.js';
import type { PegaDecisionTableRow, DecisionTreeNode } from '../../decision/PegaEvaluationResult.js';
import type { PegaExpressionEvaluator } from '../../expression/PegaExpressionEvaluator.js';

const context = new PegaClipboardContext({
  pyWorkPage: {
    Status: { type: 'Text', value: 'Open' },
    Amount: { type: 'Number', value: 100 },
    CustomerType: { type: 'Text', value: 'Premium' },
    Priority: { type: 'Text', value: 'High' },
    Name: { type: 'Text', value: 'John' },
  },
});

const mockEvaluator = {
  evaluate: (_expr: string) => {
    const customResults: Record<string, unknown> = {
      '@MyRule.IsHigh': true,
      '@MyRule.IsLow': false,
      '@MyRule.Null': null,
    };
    const val = _expr in customResults ? customResults[_expr] : true;
    return { value: { value: val, boolean: Boolean(val) }, trace: [] };
  },
} as unknown as PegaExpressionEvaluator;

describe('PegaConditionOperatorRegistry', () => {
  it('EQUALS returns true for equal values and false for different values', () => {
    expect(PegaConditionOperatorRegistry.evaluate('EQUALS', 'Open', 'Open')).toBe(true);
    expect(PegaConditionOperatorRegistry.evaluate('EQUALS', 'Open', 'Closed')).toBe(false);
    expect(PegaConditionOperatorRegistry.evaluate('EQUALS', 100, 100)).toBe(true);
    expect(PegaConditionOperatorRegistry.evaluate('EQUALS', 100, 99)).toBe(false);
  });

  it('NOT_EQUALS returns true for different values', () => {
    expect(PegaConditionOperatorRegistry.evaluate('NOT_EQUALS', 'Open', 'Closed')).toBe(true);
    expect(PegaConditionOperatorRegistry.evaluate('NOT_EQUALS', 'Open', 'Open')).toBe(false);
    expect(PegaConditionOperatorRegistry.evaluate('NOT_EQUALS', 100, 99)).toBe(true);
  });

  it('GREATER, LESS, GREATER_EQUALS, LESS_EQUALS perform numeric comparisons', () => {
    expect(PegaConditionOperatorRegistry.evaluate('GREATER', 10, 5)).toBe(true);
    expect(PegaConditionOperatorRegistry.evaluate('GREATER', 5, 10)).toBe(false);
    expect(PegaConditionOperatorRegistry.evaluate('GREATER', 5, 5)).toBe(false);

    expect(PegaConditionOperatorRegistry.evaluate('LESS', 5, 10)).toBe(true);
    expect(PegaConditionOperatorRegistry.evaluate('LESS', 10, 5)).toBe(false);
    expect(PegaConditionOperatorRegistry.evaluate('LESS', 5, 5)).toBe(false);

    expect(PegaConditionOperatorRegistry.evaluate('GREATER_EQUALS', 10, 10)).toBe(true);
    expect(PegaConditionOperatorRegistry.evaluate('GREATER_EQUALS', 10, 5)).toBe(true);
    expect(PegaConditionOperatorRegistry.evaluate('GREATER_EQUALS', 5, 10)).toBe(false);

    expect(PegaConditionOperatorRegistry.evaluate('LESS_EQUALS', 5, 10)).toBe(true);
    expect(PegaConditionOperatorRegistry.evaluate('LESS_EQUALS', 10, 10)).toBe(true);
    expect(PegaConditionOperatorRegistry.evaluate('LESS_EQUALS', 10, 5)).toBe(false);
  });

  it('IN operator checks array membership', () => {
    expect(PegaConditionOperatorRegistry.evaluate('IN', 'Open', ['Open', 'Closed'])).toBe(true);
    expect(PegaConditionOperatorRegistry.evaluate('IN', 'Pending', ['Open', 'Closed'])).toBe(false);
    expect(PegaConditionOperatorRegistry.evaluate('IN', 1, [1, 2, 3])).toBe(true);
    expect(PegaConditionOperatorRegistry.evaluate('IN', 4, [1, 2, 3])).toBe(false);
  });

  it('NOT_IN returns true when value is not in array', () => {
    expect(PegaConditionOperatorRegistry.evaluate('NOT_IN', 'Pending', ['Open', 'Closed'])).toBe(true);
    expect(PegaConditionOperatorRegistry.evaluate('NOT_IN', 'Open', ['Open', 'Closed'])).toBe(false);
  });

  it('IS_NULL returns true for null and undefined, false for non-null', () => {
    expect(PegaConditionOperatorRegistry.evaluate('IS_NULL', null, null)).toBe(true);
    expect(PegaConditionOperatorRegistry.evaluate('IS_NULL', undefined, null)).toBe(true);
    expect(PegaConditionOperatorRegistry.evaluate('IS_NULL', '', null)).toBe(false);
    expect(PegaConditionOperatorRegistry.evaluate('IS_NULL', 0, null)).toBe(false);
    expect(PegaConditionOperatorRegistry.evaluate('IS_NULL', false, null)).toBe(false);
  });

  it('IS_BLANK returns true for empty string, null, undefined; false for non-empty', () => {
    expect(PegaConditionOperatorRegistry.evaluate('IS_BLANK', null, null)).toBe(true);
    expect(PegaConditionOperatorRegistry.evaluate('IS_BLANK', undefined, null)).toBe(true);
    expect(PegaConditionOperatorRegistry.evaluate('IS_BLANK', '', null)).toBe(true);
    expect(PegaConditionOperatorRegistry.evaluate('IS_BLANK', 'text', null)).toBe(false);
    expect(PegaConditionOperatorRegistry.evaluate('IS_BLANK', 0, null)).toBe(false);
  });

  it('CUSTOM operator always returns true via registry (delegated at evaluator level)', () => {
    expect(PegaConditionOperatorRegistry.evaluate('CUSTOM', null, null)).toBe(true);
    expect(PegaConditionOperatorRegistry.evaluate('CUSTOM', 'anything', 'anything')).toBe(true);
  });

  it('hasOperator returns correct boolean', () => {
    expect(PegaConditionOperatorRegistry.hasOperator('EQUALS')).toBe(true);
    expect(PegaConditionOperatorRegistry.hasOperator('CUSTOM')).toBe(true);
    expect(PegaConditionOperatorRegistry.hasOperator('IN')).toBe(true);
  });

  it('evaluate throws for unknown operator key', () => {
    expect(() => PegaConditionOperatorRegistry.evaluate('UNKNOWN' as any, null, null)).toThrow('Unknown decision operator');
  });
});

describe('PegaDecisionConditionParser', () => {
  it('parses simple condition JSON with field, operator, value', () => {
    const cond = parseDecisionCondition({ field: 'Status', operator: 'equals', value: 'Open' });
    expect(cond.field).toBe('Status');
    expect(cond.operator).toBe('EQUALS');
    expect(cond.value).toBe('Open');
  });

  it('parses conditions with all operator types', () => {
    expect(parseDecisionCondition({ field: 'a', operator: '>', value: 5 }).operator).toBe('GREATER');
    expect(parseDecisionCondition({ field: 'a', operator: '<', value: 10 }).operator).toBe('LESS');
    expect(parseDecisionCondition({ field: 'a', operator: '>=', value: 5 }).operator).toBe('GREATER_EQUALS');
    expect(parseDecisionCondition({ field: 'a', operator: '<=', value: 5 }).operator).toBe('LESS_EQUALS');
    expect(parseDecisionCondition({ field: 'a', operator: 'in', value: [1, 2] }).operator).toBe('IN');
    expect(parseDecisionCondition({ field: 'a', operator: 'not_in', value: [1, 2] }).operator).toBe('NOT_IN');
    expect(parseDecisionCondition({ field: 'a', operator: 'is_null', value: null }).operator).toBe('IS_NULL');
    expect(parseDecisionCondition({ field: 'a', operator: 'is_blank', value: null }).operator).toBe('IS_BLANK');
    expect(parseDecisionCondition({ field: 'a', operator: 'custom', value: '@MyRule.X' }).operator).toBe('CUSTOM');
  });

  it('normalizes operator name aliases', () => {
    expect(parseDecisionCondition({ field: 'a', operator: 'equals' }).operator).toBe('EQUALS');
    expect(parseDecisionCondition({ field: 'a', operator: 'equal' }).operator).toBe('EQUALS');
    expect(parseDecisionCondition({ field: 'a', operator: '=' }).operator).toBe('EQUALS');
    expect(parseDecisionCondition({ field: 'a', operator: '<>' }).operator).toBe('NOT_EQUALS');
    expect(parseDecisionCondition({ field: 'a', operator: '!=' }).operator).toBe('NOT_EQUALS');
    expect(parseDecisionCondition({ field: 'a', operator: '>' }).operator).toBe('GREATER');
    expect(parseDecisionCondition({ field: 'a', operator: '<' }).operator).toBe('LESS');
    expect(parseDecisionCondition({ field: 'a', operator: 'is_null' }).operator).toBe('IS_NULL');
    expect(parseDecisionCondition({ field: 'a', operator: 'is_blank' }).operator).toBe('IS_BLANK');
  });

  it('handles CUSTOM prefix and @ prefix', () => {
    expect(parseDecisionCondition({ field: 'a', operator: 'CustomRule', value: '@expr' }).operator).toBe('CUSTOM');
    expect(parseDecisionCondition({ field: 'a', operator: '@MyRule', value: '@expr' }).operator).toBe('CUSTOM');
  });

  it('handles edge case with missing optional fields', () => {
    const cond = parseDecisionCondition({});
    expect(cond.field).toBe('');
    expect(cond.operator).toBe('EQUALS');
    expect(cond.value).toBeUndefined();
  });

  it('defaults unknown operator to EQUALS', () => {
    const cond = parseDecisionCondition({ field: 'Status', operator: 'unknown_op', value: 'X' });
    expect(cond.operator).toBe('EQUALS');
  });
});

describe('PegaDecisionTableEvaluator', () => {
  const evaluator = new PegaDecisionTableEvaluator();

  it('single matching row returns correct result with tracePath', () => {
    const rows: PegaDecisionTableRow[] = [
      { rowId: 'R1', priority: 1, conditions: [{ field: 'Status', operator: 'EQUALS', value: 'Open' }], result: 'Approved' },
    ];
    const result = evaluator.evaluate(rows, context, mockEvaluator);
    expect(result.status).toBe('matched');
    expect(result.matchedRowId).toBe('R1');
    expect(result.outputValue).toBe('Approved');
    expect(result.tracePath).toContain('=> matched row:R1');
  });

  it('multiple rows with higher priority (lower number) wins', () => {
    const rows: PegaDecisionTableRow[] = [
      { rowId: 'R2', priority: 2, conditions: [{ field: 'Status', operator: 'EQUALS', value: 'Open' }], result: 'Fallback' },
      { rowId: 'R1', priority: 1, conditions: [{ field: 'Status', operator: 'EQUALS', value: 'Open' }], result: 'Primary' },
    ];
    const result = evaluator.evaluate(rows, context, mockEvaluator);
    expect(result.status).toBe('matched');
    expect(result.matchedRowId).toBe('R1');
    expect(result.outputValue).toBe('Primary');
  });

  it('no matching row returns null result with all rows evaluated in tracePath', () => {
    const rows: PegaDecisionTableRow[] = [
      { rowId: 'R1', priority: 1, conditions: [{ field: 'Status', operator: 'EQUALS', value: 'Closed' }], result: 'X' },
      { rowId: 'R2', priority: 2, conditions: [{ field: 'Amount', operator: 'GREATER', value: 999 }], result: 'Y' },
    ];
    const result = evaluator.evaluate(rows, context, mockEvaluator);
    expect(result.status).toBe('no_match');
    expect(result.matchedRowId).toBe('');
    expect(result.outputValue).toBeNull();
    expect(result.tracePath).toContain('=> no matching row');
    expect(result.tracePath.filter(t => t.startsWith('row:')).length).toBe(2);
  });

  it('all conditions in a row must match (AND logic)', () => {
    const rows: PegaDecisionTableRow[] = [
      {
        rowId: 'R1', priority: 1,
        conditions: [
          { field: 'Status', operator: 'EQUALS', value: 'Open' },
          { field: 'Amount', operator: 'GREATER', value: 500 },
        ],
        result: 'HighAmount',
      },
    ];
    const result = evaluator.evaluate(rows, context, mockEvaluator);
    expect(result.status).toBe('no_match');
  });

  it('row with CUSTOM condition delegates to expression evaluator returning true', () => {
    const rows: PegaDecisionTableRow[] = [
      { rowId: 'R1', priority: 1, conditions: [{ field: '', operator: 'CUSTOM', value: '@MyRule.IsHigh' }], result: 'CustomMatch' },
    ];
    const result = evaluator.evaluate(rows, context, mockEvaluator);
    expect(result.status).toBe('matched');
    expect(result.outputValue).toBe('CustomMatch');
  });

  it('row with CUSTOM condition returning false does not match', () => {
    const rows: PegaDecisionTableRow[] = [
      { rowId: 'R1', priority: 1, conditions: [{ field: '', operator: 'CUSTOM', value: '@MyRule.IsLow' }], result: 'NoMatch' },
    ];
    const result = evaluator.evaluate(rows, context, mockEvaluator);
    expect(result.status).toBe('no_match');
  });

  it('empty table returns null result immediately', () => {
    const result = evaluator.evaluate([], context, mockEvaluator);
    expect(result.status).toBe('no_match');
    expect(result.matchedRowId).toBe('');
    expect(result.outputValue).toBeNull();
  });
});

describe('PegaDecisionTreeEvaluator', () => {
  it('simple condition tree resolves to leaf result', () => {
    const tree: DecisionTreeNode = {
      nodeId: 'N1',
      condition: { field: 'Status', operator: 'EQUALS', value: 'Open' },
      branches: [
        {
          key: 'open',
          conditionResult: true,
          childNode: {
            nodeId: 'N2',
            condition: { field: 'Status', operator: 'EQUALS', value: 'Open' },
            branches: [],
            defaultResult: 'Approved',
          },
        },
      ],
    };
    const evaluator = new PegaDecisionTreeEvaluator(5);
    const result = evaluator.evaluate(tree, context, mockEvaluator);
    expect(result.status).toBe('matched');
    expect(result.outputValue).toBe('Approved');
    expect(result.matchedRowId).toBe('N2');
  });

  it('nested tree with multiple branches navigates correct path', () => {
    const tree: DecisionTreeNode = {
      nodeId: 'Root',
      condition: { field: 'Amount', operator: 'GREATER', value: 50 },
      branches: [
        {
          key: 'highAmount',
          conditionResult: true,
          childNode: {
            nodeId: 'HighBranch',
            condition: { field: 'Status', operator: 'EQUALS', value: 'Open' },
            branches: [
              {
                key: 'open', conditionResult: true,
                childNode: { nodeId: 'LeafHO', condition: { field: 'Status', operator: 'EQUALS', value: 'Open' }, branches: [], defaultResult: 'HighOpen' },
              },
              {
                key: 'closed', conditionResult: false,
                childNode: { nodeId: 'LeafHC', condition: { field: 'Status', operator: 'EQUALS', value: 'Open' }, branches: [], defaultResult: 'HighClosed' },
              },
            ],
          },
        },
        {
          key: 'lowAmount',
          conditionResult: false,
          childNode: {
            nodeId: 'LowBranch',
            condition: { field: 'Status', operator: 'EQUALS', value: 'Open' },
            branches: [
              {
                key: 'open', conditionResult: true,
                childNode: { nodeId: 'LeafLO', condition: { field: 'Status', operator: 'EQUALS', value: 'Open' }, branches: [], defaultResult: 'LowOpen' },
              },
            ],
          },
        },
      ],
    };
    const evaluator = new PegaDecisionTreeEvaluator(5);
    const result = evaluator.evaluate(tree, context, mockEvaluator);
    expect(result.status).toBe('matched');
    expect(result.outputValue).toBe('HighOpen');
  });

  it('no matching branch returns defaultResult from node', () => {
    const tree: DecisionTreeNode = {
      nodeId: 'N1',
      condition: { field: 'Status', operator: 'EQUALS', value: 'Closed' },
      branches: [
        {
          key: 'noMatch',
          conditionResult: 'something_else',
          childNode: null,
        },
      ],
      defaultResult: 'DefaultFallback',
    };
    const evaluator = new PegaDecisionTreeEvaluator(5);
    const result = evaluator.evaluate(tree, context, mockEvaluator);
    expect(result.status).toBe('matched');
    expect(result.outputValue).toBe('DefaultFallback');
  });

  it('tree with no defaultResult and no match returns null', () => {
    const tree: DecisionTreeNode = {
      nodeId: 'N1',
      condition: { field: 'Status', operator: 'EQUALS', value: 'Closed' },
      branches: [
        {
          key: 'noMatch',
          conditionResult: 'something_else',
          childNode: null,
        },
      ],
    };
    const evaluator = new PegaDecisionTreeEvaluator(5);
    const result = evaluator.evaluate(tree, context, mockEvaluator);
    expect(result.status).toBe('no_match');
    expect(result.outputValue).toBeNull();
  });

  it('max depth exceeded returns error with outputValue null', () => {
    const deepTree: DecisionTreeNode = {
      nodeId: 'Root',
      condition: { field: 'Status', operator: 'EQUALS', value: 'Open' },
      branches: [
        {
          key: 'child',
          conditionResult: true,
          childNode: {
            nodeId: 'Child',
            condition: { field: 'Status', operator: 'EQUALS', value: 'Open' },
            branches: [],
            defaultResult: 'Result',
          },
        },
      ],
    };
    const evaluator = new PegaDecisionTreeEvaluator(0);
    const result = evaluator.evaluate(deepTree, context, mockEvaluator);
    expect(result.status).toBe('error');
    expect(result.outputValue).toBeNull();
    expect(result.error).toContain('max depth');
    expect(result.tracePath).toContain('ERROR: max depth exceeded');
  });

  it('leaf node with no branches returns defaultResult directly', () => {
    const leaf: DecisionTreeNode = {
      nodeId: 'Leaf',
      condition: { field: 'Status', operator: 'EQUALS', value: 'Open' },
      branches: [],
      defaultResult: 'LeafResult',
    };
    const evaluator = new PegaDecisionTreeEvaluator(5);
    const result = evaluator.evaluate(leaf, context, mockEvaluator);
    expect(result.status).toBe('matched');
    expect(result.outputValue).toBe('LeafResult');
  });

  it('branch matching with null conditionResult', () => {
    const tree: DecisionTreeNode = {
      nodeId: 'N1',
      condition: { field: 'Status', operator: 'CUSTOM', value: '@MyRule.Null' },
      branches: [
        {
          key: 'nullBranch',
          conditionResult: null,
          childNode: {
            nodeId: 'N2',
            condition: { field: 'Status', operator: 'EQUALS', value: 'Open' },
            branches: [],
            defaultResult: 'NullMatched',
          },
        },
      ],
    };
    const evaluator = new PegaDecisionTreeEvaluator(5);
    const result = evaluator.evaluate(tree, context, mockEvaluator);
    expect(result.status).toBe('matched');
    expect(result.outputValue).toBe('NullMatched');
  });
});

describe('PegaStrategyComponentResolver', () => {
  const resolver = new PegaStrategyComponentResolver();

  it('resolves DecisionTree:treeName to decision_rule type', () => {
    const result = resolver.resolve('DecisionTree:MyTree');
    expect(result.type).toBe('decision_rule');
    expect(result.ref).toBe('DecisionTree:MyTree');
    expect(result.resolved).toBe(false);
  });

  it('resolves DecisionTable:tableName to decision_rule type', () => {
    const result = resolver.resolve('DecisionTable:MyTable');
    expect(result.type).toBe('decision_rule');
    expect(result.ref).toBe('DecisionTable:MyTable');
    expect(result.resolved).toBe(false);
  });

  it('resolves AdaptiveModel:name to adaptive_model type', () => {
    const result = resolver.resolve('AdaptiveModel:MyModel');
    expect(result.type).toBe('adaptive_model');
    expect(result.ref).toBe('AdaptiveModel:MyModel');
    expect(result.resolved).toBe(false);
  });

  it('resolves adaptive: prefix to adaptive_model type', () => {
    const result = resolver.resolve('adaptive:MyModel');
    expect(result.type).toBe('adaptive_model');
  });

  it('returns decision_rule type for unknown reference format', () => {
    const result = resolver.resolve('UnknownType:Something');
    expect(result.type).toBe('decision_rule');
    expect(result.ref).toBe('UnknownType:Something');
  });

  it('resolveWithContext throws for adaptive model', () => {
    expect(() => resolver.resolveWithContext('AdaptiveModel:Test', {})).toThrow('not implemented');
  });
});

describe('fieldResolver', () => {
  it('resolves .Property path from clipboard', () => {
    const value = resolveFieldValue('.Status', context);
    expect(value).toBe('Open');
  });

  it('resolves .Nested.Property path from clipboard', () => {
    const value = resolveFieldValue('.CustomerType', context);
    expect(value).toBe('Premium');
  });

  it('resolves pyWorkPage.Property path from clipboard', () => {
    const value = resolveFieldValue('pyWorkPage.Name', context);
    expect(value).toBe('John');
  });

  it('resolves pyWorkPage.Nested.Property path from clipboard', () => {
    const value = resolveFieldValue('pyWorkPage.CustomerType', context);
    expect(value).toBe('Premium');
  });

  it('returns null for missing property path', () => {
    const value = resolveFieldValue('.NonExistent', context);
    expect(value).toBeNull();
  });

  it('returns null for missing page path', () => {
    const value = resolveFieldValue('MissingPage.Prop', context);
    expect(value).toBeNull();
  });
});
