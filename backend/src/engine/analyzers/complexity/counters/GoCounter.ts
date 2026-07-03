/**
 * KSA-161: Go decision point counter.
 */

import type { SyntaxNode } from '../../../parsers/types.js';
import { BaseNodeCounter } from './BaseNodeCounter.js';

export class GoCounter extends BaseNodeCounter {
  readonly language = 'go';
  readonly branchNodeTypes = [
    'if_statement',
    'expression_case',       // switch case
    'type_case',             // type switch case
    'select_statement',
    'communication_case',
  ];
  readonly loopNodeTypes = [
    'for_statement',
  ];
  readonly logicalOperators = ['&&', '||'];
  readonly exceptionNodeTypes: string[] = []; // Go uses error returns, not exceptions

  protected isLogicalOp(node: SyntaxNode): boolean {
    if (node.type === 'binary_expression') {
      const op = node.childForFieldName('operator');
      if (op && this.logicalOperators.includes(op.text)) return true;
    }
    return false;
  }

  protected getReturnNodeTypes(): string[] {
    return ['return_statement'];
  }
}
