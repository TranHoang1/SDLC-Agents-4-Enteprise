import { PegaExpressionParser } from './PegaExpressionParser.js';
import { PegaClipboardContext } from './PegaClipboardContext.js';
import { PegValue } from './PegaExpressionAst.js';
import type { ExpressionAstNode } from './PegaExpressionAst.js';

export interface EvaluationResult {
  value: PegValue;
  trace: string[];
}

export class PegaExpressionEvaluator {
  private parser = new PegaExpressionParser();

  evaluate(
    expression: string,
    clipboard: PegaClipboardContext,
    collectTrace: boolean = false,
  ): EvaluationResult {
    const ast = this.parser.parse(expression);
    const trace: string[] = [];
    const value = this.evaluateNode(ast, clipboard, trace, collectTrace, 0);
    return { value, trace };
  }

  evaluateWithAst(
    ast: ExpressionAstNode,
    clipboard: PegaClipboardContext,
    collectTrace: boolean = false,
  ): EvaluationResult {
    const trace: string[] = [];
    const value = this.evaluateNode(ast, clipboard, trace, collectTrace, 0);
    return { value, trace };
  }

  private evaluateNode(
    node: ExpressionAstNode,
    context: PegaClipboardContext,
    trace: string[],
    collectTrace: boolean,
    depth: number,
  ): PegValue {
    if (depth > 100) {
      throw new Error('Expression evaluation exceeded max depth of 100');
    }
    const value = node.evaluate(context);
    if (collectTrace) {
      trace.push('[' + node.nodeType + '] -> ' + value.text + ' (' + value.type + ')');
    }
    return value;
  }
}
