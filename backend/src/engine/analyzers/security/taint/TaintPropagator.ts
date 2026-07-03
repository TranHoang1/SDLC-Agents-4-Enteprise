/**
 * KSA-164: Taint Propagator — Propagates taint state through CFG blocks.
 */

import type { SyntaxNode } from '../../../parsers/types.js';
import type { BasicBlock } from '../cfg/BasicBlock.js';
import type { TaintStep, TaintSinkType } from '../types.js';
import { TaintRegistry } from './TaintRegistry.js';

export interface TaintState {
  variable: string;
  tainted: boolean;
  sourceType: string;
  sourceLine: number;
  steps: TaintStep[];
}

export class TaintPropagator {
  private registry: TaintRegistry;

  constructor(registry: TaintRegistry) {
    this.registry = registry;
  }

  /** Propagate taint through a single block, updating state map. */
  propagateBlock(block: BasicBlock, state: Map<string, TaintState>): Map<string, TaintState> {
    const newState = new Map(state);

    for (const stmt of block.statements) {
      this.propagateStatement(stmt.node, newState);
    }

    return newState;
  }

  /** Propagate taint for a single statement. */
  private propagateStatement(node: SyntaxNode, state: Map<string, TaintState>): void {
    const type = node.type;

    // Handle variable declarations and assignments
    if (type === 'lexical_declaration' || type === 'variable_declaration') {
      this.handleDeclaration(node, state);
    } else if (type === 'expression_statement') {
      const expr = node.namedChild(0);
      if (expr) this.propagateExpression(expr, state);
    } else if (type === 'assignment_expression' || type === 'augmented_assignment_expression') {
      this.handleAssignment(node, state);
    }
  }

  private handleDeclaration(node: SyntaxNode, state: Map<string, TaintState>): void {
    for (let i = 0; i < node.namedChildCount; i++) {
      const declarator = node.namedChild(i);
      if (!declarator || declarator.type !== 'variable_declarator') continue;

      const nameNode = declarator.childForFieldName('name');
      const valueNode = declarator.childForFieldName('value');
      if (!nameNode || !valueNode) continue;

      const varName = nameNode.text;
      const taintInfo = this.evaluateExpression(valueNode, state);

      if (taintInfo.tainted) {
        state.set(varName, {
          variable: varName,
          tainted: true,
          sourceType: taintInfo.sourceType,
          sourceLine: taintInfo.sourceLine,
          steps: [...taintInfo.steps, {
            variable: varName,
            line: nameNode.startPosition.row + 1,
            action: taintInfo.action,
            expression: valueNode.text.slice(0, 80),
          }],
        });
      } else {
        // Check if this is a sanitizer call
        if (this.isSanitizerCall(valueNode)) {
          state.delete(varName);
        } else {
          state.delete(varName);
        }
      }
    }
  }

  private handleAssignment(node: SyntaxNode, state: Map<string, TaintState>): void {
    const left = node.childForFieldName('left');
    const right = node.childForFieldName('right');
    if (!left || !right) return;

    if (left.type !== 'identifier') return;
    const varName = left.text;

    const taintInfo = this.evaluateExpression(right, state);
    if (taintInfo.tainted) {
      state.set(varName, {
        variable: varName,
        tainted: true,
        sourceType: taintInfo.sourceType,
        sourceLine: taintInfo.sourceLine,
        steps: [...taintInfo.steps, {
          variable: varName,
          line: left.startPosition.row + 1,
          action: taintInfo.action,
          expression: right.text.slice(0, 80),
        }],
      });
    } else {
      state.delete(varName);
    }
  }

  private propagateExpression(node: SyntaxNode, state: Map<string, TaintState>): void {
    if (node.type === 'assignment_expression' || node.type === 'augmented_assignment_expression') {
      this.handleAssignment(node, state);
    }
  }

  /** Evaluate if an expression produces a tainted value. */
  evaluateExpression(node: SyntaxNode, state: Map<string, TaintState>): {
    tainted: boolean;
    sourceType: string;
    sourceLine: number;
    steps: TaintStep[];
    action: TaintStep['action'];
  } {
    const notTainted = { tainted: false, sourceType: '', sourceLine: 0, steps: [], action: 'assign' as const };

    // Direct identifier reference
    if (node.type === 'identifier') {
      const existing = state.get(node.text);
      if (existing?.tainted) {
        return { tainted: true, sourceType: existing.sourceType, sourceLine: existing.sourceLine, steps: existing.steps, action: 'pass_through' };
      }
      return notTainted;
    }

    // Member expression (e.g., req.body.name)
    if (node.type === 'member_expression') {
      const text = node.text;
      const sourceMatch = this.registry.matchSource(text);
      if (sourceMatch) {
        return { tainted: true, sourceType: sourceMatch.type, sourceLine: node.startPosition.row + 1, steps: [], action: 'assign' };
      }
      // Check if object is tainted
      const obj = node.childForFieldName('object');
      if (obj) {
        const objTaint = this.evaluateExpression(obj, state);
        if (objTaint.tainted) return { ...objTaint, action: 'pass_through' };
      }
      return notTainted;
    }

    // Call expression
    if (node.type === 'call_expression') {
      const fn = node.childForFieldName('function');
      if (fn) {
        // Check if it's a sanitizer
        if (this.isSanitizerCall(node)) {
          return notTainted;
        }
        // Check if it's a source
        const sourceMatch = this.registry.matchSource(fn.text);
        if (sourceMatch) {
          return { tainted: true, sourceType: sourceMatch.type, sourceLine: node.startPosition.row + 1, steps: [], action: 'function_call' };
        }
        // Check if arguments are tainted (conservative: if any arg tainted, result tainted)
        const args = node.childForFieldName('arguments');
        if (args) {
          for (let i = 0; i < args.namedChildCount; i++) {
            const arg = args.namedChild(i);
            if (arg) {
              const argTaint = this.evaluateExpression(arg, state);
              if (argTaint.tainted) {
                return { ...argTaint, action: 'function_call' };
              }
            }
          }
        }
      }
      return notTainted;
    }

    // Template literal (template_string)
    if (node.type === 'template_string') {
      for (let i = 0; i < node.namedChildCount; i++) {
        const child = node.namedChild(i);
        if (child && child.type === 'template_substitution') {
          const expr = child.namedChild(0);
          if (expr) {
            const exprTaint = this.evaluateExpression(expr, state);
            if (exprTaint.tainted) {
              return { ...exprTaint, action: 'template_literal' };
            }
          }
        }
      }
      return notTainted;
    }

    // Binary expression (string concatenation)
    if (node.type === 'binary_expression') {
      const left = node.childForFieldName('left');
      const right = node.childForFieldName('right');
      if (left) {
        const leftTaint = this.evaluateExpression(left, state);
        if (leftTaint.tainted) return { ...leftTaint, action: 'concat' };
      }
      if (right) {
        const rightTaint = this.evaluateExpression(right, state);
        if (rightTaint.tainted) return { ...rightTaint, action: 'concat' };
      }
      return notTainted;
    }

    // Subscript/element access
    if (node.type === 'subscript_expression') {
      const obj = node.childForFieldName('object');
      if (obj) {
        const objTaint = this.evaluateExpression(obj, state);
        if (objTaint.tainted) return { ...objTaint, action: 'pass_through' };
      }
      return notTainted;
    }

    // Await expression
    if (node.type === 'await_expression') {
      const child = node.namedChild(0);
      if (child) return this.evaluateExpression(child, state);
      return notTainted;
    }

    return notTainted;
  }

  /** Check if a call expression is a sanitizer. */
  private isSanitizerCall(node: SyntaxNode): boolean {
    const fn = node.type === 'call_expression' ? node.childForFieldName('function') : null;
    if (!fn) return false;
    const fnText = fn.text;

    // Check against all sink types
    const sinkTypes: TaintSinkType[] = ['sql_query', 'shell_exec', 'html_output', 'file_path', 'url_fetch'];
    for (const sinkType of sinkTypes) {
      if (this.registry.isSanitizer(fnText, sinkType)) return true;
    }
    return false;
  }
}