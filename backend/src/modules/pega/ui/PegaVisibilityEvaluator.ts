import type { PegaClipboardContext } from '../expression/PegaClipboardContext.js';
import { PegaExpressionEvaluator } from '../expression/PegaExpressionEvaluator.js';

export interface VisibilityElement {
  visible?: boolean;
  when?: string;
}

export class PegaVisibilityEvaluator {
  private evaluator = new PegaExpressionEvaluator();

  evaluate(
    element: VisibilityElement,
    context: PegaClipboardContext,
  ): boolean {
    if (element.visible === false) {
      return false;
    }

    if (element.when && element.when.length > 0) {
      const result = this.evaluator.evaluate(element.when, context);
      return result.value.boolean;
    }

    return true;
  }
}