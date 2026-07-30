import type { PegaEvaluationResult, DecisionTreeNode } from './PegaEvaluationResult.js';
import type { PegaClipboardContext } from '../expression/PegaClipboardContext.js';
import type { PegaExpressionEvaluator } from '../expression/PegaExpressionEvaluator.js';
import { PegaConditionOperatorRegistry } from './PegaConditionOperatorRegistry.js';
import { resolveFieldValue } from './fieldResolver.js';

const MAX_DEPTH = 50;

export class PegaDecisionTreeEvaluator {
  private maxDepth: number;

  constructor(maxDepth: number = MAX_DEPTH) {
    this.maxDepth = maxDepth;
  }

  evaluate(
    node: DecisionTreeNode,
    context: PegaClipboardContext,
    evaluator: PegaExpressionEvaluator,
    currentDepth: number = 0,
    tracePath: string[] = [],
  ): PegaEvaluationResult {
    if (currentDepth > this.maxDepth) {
      return {
        matchedRowId: node.nodeId,
        outputValue: null,
        tracePath: [...tracePath, 'ERROR: max depth exceeded'],
        status: 'error',
        error: 'Decision tree evaluation exceeded max depth of ' + this.maxDepth,
      };
    }

    tracePath.push('node:' + node.nodeId);

    if (node.branches.length === 0) {
      tracePath.push('=> leaf, result=' + String(node.defaultResult));
      return {
        matchedRowId: node.nodeId,
        outputValue: node.defaultResult ?? null,
        tracePath: [...tracePath],
        status: 'matched',
      };
    }

    const fieldValue = resolveFieldValue(node.condition.field, context);

    let conditionResult: unknown;
    if (node.condition.operator === 'CUSTOM') {
      conditionResult = this.evaluateCustomCondition(
        node.condition.value as string,
        context,
        evaluator,
      );
    } else {
      conditionResult = PegaConditionOperatorRegistry.evaluate(
        node.condition.operator,
        fieldValue,
        node.condition.value,
      );
    }

    tracePath.push('  cond:' + node.condition.field + ' ' + node.condition.operator + ' => ' + String(conditionResult));

    const matchingBranch = node.branches.find((b) => {
      if (b.conditionResult === null && (conditionResult === null || conditionResult === undefined)) return true;
      return String(b.conditionResult) === String(conditionResult);
    });

    if (matchingBranch && matchingBranch.childNode) {
      tracePath.push('  branch:' + matchingBranch.key);
      return this.evaluate(matchingBranch.childNode, context, evaluator, currentDepth + 1, tracePath);
    }

    if (node.defaultResult !== undefined) {
      tracePath.push('=> default result=' + String(node.defaultResult));
      return {
        matchedRowId: node.nodeId,
        outputValue: node.defaultResult,
        tracePath: [...tracePath],
        status: 'matched',
      };
    }

    tracePath.push('=> no matching branch');
    return {
      matchedRowId: node.nodeId,
      outputValue: null,
      tracePath: [...tracePath],
      status: 'no_match',
    };
  }

  private evaluateCustomCondition(
    expressionText: string,
    context: PegaClipboardContext,
    evaluator: PegaExpressionEvaluator,
  ): unknown {
    try {
      const result = evaluator.evaluate(expressionText, context);
      return result.value.value;
    } catch {
      return null;
    }
  }
}