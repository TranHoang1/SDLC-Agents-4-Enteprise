/**
 * KSA-161: Kotlin decision point counter.
 */

import type { SyntaxNode } from '../../../parsers/types.js';
import { BaseNodeCounter } from './BaseNodeCounter.js';

export class KotlinCounter extends BaseNodeCounter {
  readonly language = 'kotlin';
  readonly branchNodeTypes = [
    'if_expression',
    'when_entry',
    'elvis_expression',
  ];
  readonly loopNodeTypes = [
    'for_statement',
    'while_statement',
    'do_while_statement',
  ];
  readonly logicalOperators = ['&&', '||'];
  readonly exceptionNodeTypes = ['catch_block'];

  protected isLogicalOp(node: SyntaxNode): boolean {
    if (node.type === 'conjunction_expression' || node.type === 'disjunction_expression') {
      return true;
    }
    if (node.type === 'binary_expression') {
      const op = node.childForFieldName('operator');
      if (op && this.logicalOperators.includes(op.text)) return true;
    }
    return false;
  }

  protected getReturnNodeTypes(): string[] {
    return ['jump_expression']; // Kotlin uses jump_expression for return
  }
}
