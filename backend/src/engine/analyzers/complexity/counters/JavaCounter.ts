/**
 * KSA-161: Java decision point counter.
 */

import type { SyntaxNode } from '../../../parsers/types.js';
import { BaseNodeCounter } from './BaseNodeCounter.js';

export class JavaCounter extends BaseNodeCounter {
  readonly language = 'java';
  readonly branchNodeTypes = [
    'if_statement',
    'switch_expression',
    'ternary_expression',
  ];
  readonly loopNodeTypes = [
    'for_statement',
    'enhanced_for_statement',
    'while_statement',
    'do_statement',
  ];
  readonly logicalOperators = ['&&', '||'];
  readonly exceptionNodeTypes = ['catch_clause'];

  protected isLogicalOp(node: SyntaxNode): boolean {
    if (node.type === 'binary_expression') {
      const op = node.childForFieldName('operator');
      if (op && this.logicalOperators.includes(op.text)) return true;
    }
    return false;
  }
}
