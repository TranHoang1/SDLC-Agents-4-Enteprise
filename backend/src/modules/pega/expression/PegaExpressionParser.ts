import { PegExpressionError } from './PegaExpressionAst.js';
import type { ExpressionAstNode, BinaryOperator } from './PegaExpressionAst.js';
import {
  PropertyRefNode,
  FunctionCallNode,
  StringLiteralNode,
  NumberLiteralNode,
  BooleanLiteralNode,
  BinaryOpNode,
  UnaryOpNode,
} from './PegaExpressionAst.js';
import { PegaExpressionLexer } from './PegaExpressionLexer.js';
import type { Token, TokenType } from './PegaExpressionLexer.js';

const COMPARISON_OPS: Array<{ token: TokenType; op: BinaryOperator }> = [
  { token: 'EQ', op: 'EQ' },
  { token: 'NEQ', op: 'NEQ' },
  { token: 'GT', op: 'GT' },
  { token: 'LT', op: 'LT' },
  { token: 'GTE', op: 'GTE' },
  { token: 'LTE', op: 'LTE' },
];

export class PegaExpressionParser {
  private tokens: Token[] = [];
  private pos = 0;

  parse(input: string): ExpressionAstNode {
    const lexer = new PegaExpressionLexer(input);
    this.tokens = lexer.tokenize();
    this.pos = 0;
    const result = this.parseOr();
    if (this.peek().type !== 'EOF') {
      const t = this.peek();
      throw new PegExpressionError(
        'Expected end of expression at line ' + t.line + ', column ' + t.column,
        'PARSE_ERROR',
        t.line, t.column,
      );
    }
    return result;
  }

  private parseOr(): ExpressionAstNode {
    let left = this.parseAnd();
    while (this.match('OR')) {
      const right = this.parseAnd();
      left = new BinaryOpNode('OR', left, right);
    }
    return left;
  }

  private parseAnd(): ExpressionAstNode {
    let left = this.parseNot();
    while (this.match('AND')) {
      const right = this.parseNot();
      left = new BinaryOpNode('AND', left, right);
    }
    return left;
  }

  private parseNot(): ExpressionAstNode {
    if (this.match('NOT')) {
      const operand = this.parseNot();
      return new UnaryOpNode('NOT', operand);
    }
    if (this.match('ISNULL')) {
      const operand = this.parseComparison();
      return new UnaryOpNode('ISNULL', operand);
    }
    return this.parseComparison();
  }

  private parseComparison(): ExpressionAstNode {
    const left = this.parseValue();

    for (const ct of COMPARISON_OPS) {
      if (this.match(ct.token)) {
        const right = this.parseValue();
        return new BinaryOpNode(ct.op, left, right);
      }
    }

    return left;
  }

  private parseValue(): ExpressionAstNode {
    const token = this.peek();

    if (token.type === 'LPAREN') {
      this.advance();
      const expr = this.parseOr();
      this.expect('RPAREN');
      return expr;
    }

    if (token.type === 'STRING') {
      this.advance();
      return new StringLiteralNode(token.value);
    }

    if (token.type === 'NUMBER') {
      this.advance();
      return new NumberLiteralNode(parseFloat(token.value));
    }

    if (token.type === 'IDENTIFIER' && (token.value === 'true' || token.value === 'false')) {
      this.advance();
      return new BooleanLiteralNode(token.value === 'true');
    }

    if (token.type === 'FUNCTION') {
      return this.parseFunctionCall();
    }

    if (token.type === 'DOT') {
      return this.parsePropertyRef();
    }

    if (token.type === 'IDENTIFIER') {
      return this.parsePropertyRefFromIdent();
    }

    throw new PegExpressionError(
      'Expected expression at line ' + token.line + ', column ' + token.column + ", got '" + token.value + "'",
      'PARSE_ERROR',
      token.line, token.column,
    );
  }

  private parseFunctionCall(): ExpressionAstNode {
    const token = this.expect('FUNCTION');
    this.expect('LPAREN');
    const args: ExpressionAstNode[] = [];

    if (this.peek().type !== 'RPAREN') {
      args.push(this.parseOr());
      while (this.match('COMMA')) {
        args.push(this.parseOr());
      }
    }

    this.expect('RPAREN');
    return new FunctionCallNode(token.value, args);
  }

  private parsePropertyRef(): ExpressionAstNode {
    const parts: string[] = [];
    this.expect('DOT');
    const ident = this.expect('IDENTIFIER');
    parts.push(ident.value);

    while (this.peek().type === 'DOT') {
      this.advance();
      const next = this.expect('IDENTIFIER');
      parts.push(next.value);
    }

    return new PropertyRefNode(parts);
  }

  private parsePropertyRefFromIdent(): ExpressionAstNode {
    const parts: string[] = [];
    const ident = this.expect('IDENTIFIER');
    parts.push(ident.value);

    while (this.peek().type === 'DOT') {
      this.advance();
      const next = this.expect('IDENTIFIER');
      parts.push(next.value);
    }

    return new PropertyRefNode(parts);
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    return this.tokens[this.pos++];
  }

  private match(type: TokenType): boolean {
    if (this.peek().type === type) {
      this.advance();
      return true;
    }
    return false;
  }

  private expect(type: TokenType): Token {
    const token = this.peek();
    if (token.type !== type) {
      throw new PegExpressionError(
        'Expected ' + type + ' at line ' + token.line + ', column ' + token.column + ", got '" + token.value + "'",
        'PARSE_ERROR',
        token.line, token.column,
      );
    }
    return this.advance();
  }
}
