import type { DecisionOperator } from './PegaEvaluationResult.js';
import type { PegValue } from '../expression/PegaExpressionAst.js';

type OperatorHandler = (fieldValue: unknown, conditionValue: unknown, fieldPegValue?: PegValue) => boolean;

export class PegaConditionOperatorRegistry {
  private static handlers = new Map<DecisionOperator, OperatorHandler>([
    ['EQUALS', (fv, cv) => fv == cv],
    ['NOT_EQUALS', (fv, cv) => fv != cv],
    ['GREATER', (fv, cv) => {
      if (typeof fv === 'number' && typeof cv === 'number') return fv > cv;
      if (typeof fv === 'string' && typeof cv === 'string') return fv > cv;
      return Number(fv) > Number(cv);
    }],
    ['GREATER_EQUALS', (fv, cv) => {
      if (typeof fv === 'number' && typeof cv === 'number') return fv >= cv;
      if (typeof fv === 'string' && typeof cv === 'string') return fv >= cv;
      return Number(fv) >= Number(cv);
    }],
    ['LESS', (fv, cv) => {
      if (typeof fv === 'number' && typeof cv === 'number') return fv < cv;
      if (typeof fv === 'string' && typeof cv === 'string') return fv < cv;
      return Number(fv) < Number(cv);
    }],
    ['LESS_EQUALS', (fv, cv) => {
      if (typeof fv === 'number' && typeof cv === 'number') return fv <= cv;
      if (typeof fv === 'string' && typeof cv === 'string') return fv <= cv;
      return Number(fv) <= Number(cv);
    }],
    ['IN', (fv, cv) => Array.isArray(cv) && cv.includes(fv)],
    ['NOT_IN', (fv, cv) => !Array.isArray(cv) || !cv.includes(fv)],
    ['IS_NULL', (fv) => fv === null || fv === undefined],
    ['IS_BLANK', (fv) => fv === null || fv === undefined || fv === ''],
    ['CUSTOM', () => true],
  ]);

  static hasOperator(op: DecisionOperator): boolean {
    return this.handlers.has(op);
  }

  static evaluate(
    operator: DecisionOperator,
    fieldValue: unknown,
    conditionValue: unknown,
    fieldPegValue?: PegValue,
  ): boolean {
    const handler = this.handlers.get(operator);
    if (!handler) {
      throw new Error('Unknown decision operator: ' + operator);
    }
    return handler(fieldValue, conditionValue, fieldPegValue);
  }

  static registerOperator(operator: DecisionOperator, handler: OperatorHandler): void {
    this.handlers.set(operator, handler);
  }
}