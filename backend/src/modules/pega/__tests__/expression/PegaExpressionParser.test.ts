import { describe, it, expect } from 'vitest';
import { PegaExpressionParser } from '../../expression/PegaExpressionParser.js';
import { PegExpressionError } from '../../expression/PegaExpressionAst.js';

describe('PegaExpressionParser', () => {
  const parser = new PegaExpressionParser();

  it('parses property ref .Order.Total', () => {
    const ast = parser.parse('.Order.Total');
    expect(ast.nodeType).toBe('PropertyRef');
    expect((ast as any).parts).toEqual(['Order', 'Total']);
  });

  it('parses single property ref .Name', () => {
    const ast = parser.parse('.Name');
    expect((ast as any).parts).toEqual(['Name']);
  });

  it('parses string literal "Open"', () => {
    const ast = parser.parse('"Open"');
    expect(ast.nodeType).toBe('StringLiteral');
    expect((ast as any).value).toBe('Open');
  });

  it('parses number literal 100', () => {
    const ast = parser.parse('100');
    expect(ast.nodeType).toBe('NumberLiteral');
    expect((ast as any).value).toBe(100);
  });

  it('parses function call @round(.Amount, 2)', () => {
    const ast = parser.parse('@round(.Amount, 2)');
    expect(ast.nodeType).toBe('FunctionCall');
    expect((ast as any).name).toBe('@round');
    const args = (ast as any).args;
    expect(args.length).toBe(2);
    expect(args[0].nodeType).toBe('PropertyRef');
    expect(args[1].nodeType).toBe('NumberLiteral');
  });

  it('parses comparison .Status = "Open"', () => {
    const ast = parser.parse('.Status = "Open"');
    expect(ast.nodeType).toBe('BinaryOp');
    expect((ast as any).operator).toBe('EQ');
  });

  it('parses compound .Status = "Open" .AND. .Amount > 100', () => {
    const ast = parser.parse('.Status = "Open" .AND. .Amount > 100');
    expect(ast.nodeType).toBe('BinaryOp');
    expect((ast as any).operator).toBe('AND');
  });

  it('parses NOT .NOT. .Status = "Closed"', () => {
    const ast = parser.parse('.NOT. .Status = "Closed"');
    expect(ast.nodeType).toBe('UnaryOp');
    expect((ast as any).operator).toBe('NOT');
  });

  it('parses ISNULL .ISNULL .Amount', () => {
    const ast = parser.parse('.ISNULL .Amount');
    expect(ast.nodeType).toBe('UnaryOp');
    expect((ast as any).operator).toBe('ISNULL');
  });

  it('parses function @upper(.Name)', () => {
    const ast = parser.parse('@upper(.Name)');
    expect(ast.nodeType).toBe('FunctionCall');
    expect((ast as any).name).toBe('@upper');
  });

  it('parses @CurrentDate()', () => {
    const ast = parser.parse('@CurrentDate()');
    expect(ast.nodeType).toBe('FunctionCall');
    expect((ast as any).args.length).toBe(0);
  });

  it('parses @If with 3 args', () => {
    const ast = parser.parse('@If(.Type = "VIP", .Limit, 0)');
    expect(ast.nodeType).toBe('FunctionCall');
    expect((ast as any).args.length).toBe(3);
  });

  it('handles parentheses (.Amount > 100 .OR. .Priority = "High")', () => {
    const ast = parser.parse('(.Amount > 100 .OR. .Priority = "High")');
    expect(ast.nodeType).toBe('BinaryOp');
    expect((ast as any).operator).toBe('OR');
  });

  it('throws on parse error', () => {
    expect(() => parser.parse('.Status =')).toThrow(PegExpressionError);
  });
});
