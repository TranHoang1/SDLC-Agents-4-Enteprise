/**
 * KSA-161: TypeScript/JavaScript decision point counter.
 */

import type { SyntaxNode } from '../../../parsers/types.js';
import { BaseNodeCounter } from './BaseNodeCounter.js';

export class TypeScriptCounter extends BaseNodeCounter {
  readonly language = 'typescript';
  readonly branchNodeTypes = [
    'if_statement',
    'switch_case',
    'ternary_expression',
  ];
  readonly loopNodeTypes = [
    'for_statement',
    'for_in_statement',
    'while_statement',
    'do_statement',
  ];
  readonly logicalOperators = ['&&', '||', '??'];
  readonly exceptionNodeTypes = ['catch_clause'];

  protected isLogicalOp(node: SyntaxNode): boolean {
    // TypeScript uses binary_expression for && and ||
    if (node.type === 'binary_expression') {
      const op = node.childForFieldName('operator');
      if (op && this.logicalOperators.includes(op.text)) return true;
    }
    // Optional chaining counted as a branch decision
    if (node.type === 'optional_chain_expression') return true;
    return false;
  }
}
