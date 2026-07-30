import { describe, it, expect } from 'vitest';
import { PegaExpressionLexer } from '../../expression/PegaExpressionLexer.js';
import { PegExpressionError } from '../../expression/PegaExpressionAst.js';

describe('PegaExpressionLexer', () => {
  it('tokenizes property reference .Customer.Name', () => {
    const lexer = new PegaExpressionLexer('.Customer.Name');
    const tokens = lexer.tokenize();
    expect(tokens.map(t => ({ type: t.type, value: t.value }))).toEqual([
      { type: 'DOT', value: '.' },
      { type: 'IDENTIFIER', value: 'Customer' },
      { type: 'DOT', value: '.' },
      { type: 'IDENTIFIER', value: 'Name' },
      { type: 'EOF', value: '' },
    ]);
  });

  it('tokenizes string literal', () => {
    const lexer = new PegaExpressionLexer('"hello world"');
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe('STRING');
    expect(tokens[0].value).toBe('hello world');
  });

  it('tokenizes single-quoted string', () => {
    const lexer = new PegaExpressionLexer("'hello'");
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe('STRING');
    expect(tokens[0].value).toBe('hello');
  });

  it('tokenizes number 123.45', () => {
    const lexer = new PegaExpressionLexer('123.45');
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe('NUMBER');
    expect(tokens[0].value).toBe('123.45');
  });

  it('tokenizes negative number -5', () => {
    const lexer = new PegaExpressionLexer('-5');
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe('NUMBER');
    expect(tokens[0].value).toBe('-5');
  });

  it('tokenizes operators = <> > < >= <=', () => {
    const lexer = new PegaExpressionLexer('= <> > < >= <=');
    const tokens = lexer.tokenize().filter(t => t.type !== 'EOF');
    expect(tokens.map(t => t.type)).toEqual(['EQ', 'NEQ', 'GT', 'LT', 'GTE', 'LTE']);
  });

  it('tokenizes .AND. .OR. .NOT. .ISNULL', () => {
    const lexer = new PegaExpressionLexer('.AND. .OR. .NOT. .ISNULL');
    const tokens = lexer.tokenize().filter(t => t.type !== 'EOF');
    expect(tokens.map(t => t.type)).toEqual(['AND', 'OR', 'NOT', 'ISNULL']);
  });

  it('tokenizes function call @upper(.Name)', () => {
    const lexer = new PegaExpressionLexer('@upper(.Name)');
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe('FUNCTION');
    expect(tokens[0].value).toBe('@upper');
    expect(tokens[1].type).toBe('LPAREN');
    expect(tokens[2].type).toBe('DOT');
    expect(tokens[3].type).toBe('IDENTIFIER');
    expect(tokens[4].type).toBe('RPAREN');
  });

  it('throws on unexpected character', () => {
    const lexer = new PegaExpressionLexer('#bad');
    expect(() => lexer.tokenize()).toThrow(PegExpressionError);
  });

  it('throws on unterminated string', () => {
    const lexer = new PegaExpressionLexer('"unclosed');
    expect(() => lexer.tokenize()).toThrow(PegExpressionError);
  });
});
