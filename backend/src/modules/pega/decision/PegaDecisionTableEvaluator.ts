import type { PegaDecisionTableRow, PegaEvaluationResult } from './PegaEvaluationResult.js';
import type { PegaClipboardContext } from '../expression/PegaClipboardContext.js';
import type { PegaExpressionEvaluator } from '../expression/PegaExpressionEvaluator.js';
import { PegaConditionOperatorRegistry } from './PegaConditionOperatorRegistry.js';
import { resolveFieldValue } from './fieldResolver.js';

export class PegaDecisionTableEvaluator {
  evaluate(
    rows: PegaDecisionTableRow[],
    context: PegaClipboardContext,
    evaluator: PegaExpressionEvaluator,
  ): PegaEvaluationResult {
    const sorted = [...rows].sort((a, b) => a.priority - b.priority);
    const tracePath: string[] = [];

    for (const row of sorted) {
      tracePath.push('row:' + row.rowId);

      let allMatch = true;
      for (const condition of row.conditions) {
        const fieldValue = resolveFieldValue(condition.field, context);
        const traceEntry = '  cond:' + condition.field + ' ' + condition.operator;

        let matched: boolean;
        if (condition.operator === 'CUSTOM') {
          matched = this.evaluateCustomCondition(condition.value as string, context, evaluator);
        } else {
          matched = PegaConditionOperatorRegistry.evaluate(condition.operator, fieldValue, condition.value);
        }

        tracePath.push(traceEntry + ' ' + matched);
        if (!matched) {
          allMatch = false;
          break;
        }
      }

      if (allMatch) {
        tracePath.push('=> matched row:' + row.rowId);
        return {
          matchedRowId: row.rowId,
          outputValue: row.result,
          tracePath,
          status: 'matched',
        };
      }
    }

    tracePath.push('=> no matching row');
    return {
      matchedRowId: '',
      outputValue: null,
      tracePath,
      status: 'no_match',
    };
  }

  private evaluateCustomCondition(
    expressionText: string,
    context: PegaClipboardContext,
    evaluator: PegaExpressionEvaluator,
  ): boolean {
    try {
      const result = evaluator.evaluate(expressionText, context);
      return result.value.boolean;
    } catch {
      return false;
    }
  }
}