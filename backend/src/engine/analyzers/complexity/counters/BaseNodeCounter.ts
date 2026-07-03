/**
 * KSA-161: Abstract base class for language-specific AST node counters.
 * Each language subclass defines which node types represent decision points.
 */

import type { SyntaxNode } from '../../../parsers/types.js';
import type { DecisionPointCounts } from '../types.js';

export abstract class BaseNodeCounter {
  abstract readonly language: string;
  abstract readonly branchNodeTypes: string[];
  abstract readonly loopNodeTypes: string[];
  abstract readonly logicalOperators: string[];
  abstract readonly exceptionNodeTypes: string[];

  /** Count all decision points in an AST subtree (single pass). */
  countDecisionPoints(node: SyntaxNode): DecisionPointCounts {
    const counts: DecisionPointCounts = {
      branches: 0,
      loops: 0,
      logical_ops: 0,
      exception_handlers: 0,
    };
    this.walkTree(node, (child) => {
      if (this.branchNodeTypes.includes(child.type)) {
        counts.branches++;
      } else if (this.loopNodeTypes.includes(child.type)) {
        counts.loops++;
      } else if (this.exceptionNodeTypes.includes(child.type)) {
        counts.exception_handlers++;
      }
      // Check for logical operators in binary expressions
      if (this.isLogicalOp(child)) {
        counts.logical_ops++;
      }
    });
    return counts;
  }

  /** Calculate maximum nesting depth of control structures. */
  calculateNestingDepth(node: SyntaxNode): number {
    const controlTypes = [...this.branchNodeTypes, ...this.loopNodeTypes];
    let maxDepth = 0;

    const walk = (n: SyntaxNode, depth: number): void => {
      if (controlTypes.includes(n.type)) {
        depth++;
        if (depth > maxDepth) maxDepth = depth;
      }
      for (let i = 0; i < n.childCount; i++) {
        const child = n.child(i);
        if (child) walk(child, depth);
      }
    };
    walk(node, 0);
    return maxDepth;
  }

  /** Count early return statements in a function body. */
  countEarlyReturns(node: SyntaxNode): number {
    let count = 0;
    const returnTypes = this.getReturnNodeTypes();
    this.walkTree(node, (child) => {
      if (returnTypes.includes(child.type)) {
        count++;
      }
    });
    // The last return doesn't count as "early"
    return Math.max(0, count - 1);
  }

  /** Override in subclass to check if a node represents a logical operator. */
  protected isLogicalOp(node: SyntaxNode): boolean {
    if (node.type === 'binary_expression' || node.type === 'logical_expression') {
      const op = node.childForFieldName('operator');
      if (op && this.logicalOperators.includes(op.text)) return true;
    }
    return false;
  }

  /** Override in subclass for language-specific return node types. */
  protected getReturnNodeTypes(): string[] {
    return ['return_statement'];
  }

  /** Walk all nodes in the tree, calling visitor for each. */
  protected walkTree(node: SyntaxNode, visitor: (n: SyntaxNode) => void): void {
    visitor(node);
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) this.walkTree(child, visitor);
    }
  }
}
