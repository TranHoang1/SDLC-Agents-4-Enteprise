import type { ExpressionAstNode } from '../expression/PegaExpressionAst.js';
import { PegaExpressionParser } from '../expression/PegaExpressionParser.js';
import { PegaFunctionWhitelist } from './PegaFunctionWhitelist.js';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  code: string;
  message: string;
}

export class PegaExpressionValidator {
  private parser = new PegaExpressionParser();
  private whitelist = new PegaFunctionWhitelist();
  private maxDepth = 100;
  private maxExpressionLength = 100_000;

  validate(expression: string): ValidationResult {
    const errors: ValidationError[] = [];

    if (!expression || expression.trim().length === 0) {
      errors.push({ code: 'EMPTY_EXPRESSION', message: 'Expression cannot be empty' });
      return { valid: false, errors };
    }

    if (expression.length > this.maxExpressionLength) {
      errors.push({
        code: 'EXPRESSION_TOO_LONG',
        message: `Expression exceeds max length of ${this.maxExpressionLength} characters`,
      });
      return { valid: false, errors };
    }

    let ast: ExpressionAstNode;
    try {
      ast = this.parser.parse(expression);
    } catch (err) {
      errors.push({
        code: 'PARSE_ERROR',
        message: (err as Error).message,
      });
      return { valid: false, errors };
    }

    this.validateAstNode(ast, 0, errors);

    return { valid: errors.length === 0, errors };
  }

  private validateAstNode(
    node: ExpressionAstNode,
    depth: number,
    errors: ValidationError[],
  ): void {
    if (depth > this.maxDepth) {
      errors.push({
        code: 'MAX_DEPTH_EXCEEDED',
        message: `Expression exceeds max depth of ${this.maxDepth}`,
      });
      return;
    }

    if (node.nodeType === 'FunctionCall') {
      const fnNode = node as any;
      if (!this.whitelist.isAllowed(fnNode.name)) {
        errors.push({
          code: 'FUNCTION_NOT_ALLOWED',
          message: `Function '${fnNode.name}' is not in whitelist`,
        });
      }
      for (const arg of fnNode.args) {
        this.validateAstNode(arg, depth + 1, errors);
      }
      return;
    }

    if (node.nodeType === 'BinaryOp') {
      const binNode = node as any;
      this.validateAstNode(binNode.left, depth + 1, errors);
      this.validateAstNode(binNode.right, depth + 1, errors);
      return;
    }

    if (node.nodeType === 'UnaryOp') {
      const unNode = node as any;
      this.validateAstNode(unNode.operand, depth + 1, errors);
      return;
    }
  }
}
