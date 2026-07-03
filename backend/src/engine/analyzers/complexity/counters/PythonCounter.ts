/**
 * KSA-161: Python decision point counter.
 */

import type { SyntaxNode } from '../../../parsers/types.js';
import { BaseNodeCounter } from './BaseNodeCounter.js';

export class PythonCounter extends BaseNodeCounter {
  readonly language = 'python';
  readonly branchNodeTypes = [
    'if_statement',
    'elif_clause',
    'conditional_expression',  // ternary: x if cond else y
  ];
  readonly loopNodeTypes = [
    'for_statement',
    'while_statement',
  ];
  readonly logicalOperators = ['and', 'or'];
  readonly exceptionNodeTypes = ['except_clause'];

  protected isLogicalOp(node: SyntaxNode): boolean {
    if (node.type === 'boolean_operator') {
      const op = node.childForFieldName('operator');
      if (op && this.logicalOperators.includes(op.text)) return true;
      // Fallback: check children for 'and'/'or' keywords
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child && (child.text === 'and' || child.text === 'or')) return true;
      }
    }
    return false;
  }

  protected getReturnNodeTypes(): string[] {
    return ['return_statement'];
  }
}
