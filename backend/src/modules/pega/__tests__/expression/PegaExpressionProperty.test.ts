import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { PegaExpressionLexer } from '../../expression/PegaExpressionLexer.js';
import { PegaExpressionParser } from '../../expression/PegaExpressionParser.js';
import { PegaExpressionEvaluator } from '../../expression/PegaExpressionEvaluator.js';
import { PegaClipboardContext } from '../../expression/PegaClipboardContext.js';
import {
  PropertyRefNode,
  NumberLiteralNode,
  StringLiteralNode,
  BooleanLiteralNode,
  NullLiteralNode,
  BinaryOpNode,
  UnaryOpNode,
  FunctionCallNode,
} from '../../expression/PegaExpressionAst.js';

const isSimpleString = (s: string): boolean =>
  !s.includes('"') && !s.includes("'") && !s.includes('\\') && !s.includes('\n') && !s.includes('\t');

const isValidIdentifier = (s: string): boolean => /^[a-zA-Z_]\w*$/.test(s);

const evaluator = new PegaExpressionEvaluator();
const parser = new PegaExpressionParser();

describe('Lexer properties', () => {

  it('produces NUMBER tokens for numeric input with consistent parseFloat values', () => {
    fc.assert(fc.property(
      fc.integer({ min: -999999, max: 999999 }).filter(n => n !== -0),
      (n) => {
        const lexer = new PegaExpressionLexer(String(n));
        const tokens = lexer.tokenize();
        expect(tokens[0].type).toBe('NUMBER');
        expect(parseFloat(tokens[0].value)).toBe(n);
        expect(tokens[tokens.length - 1].type).toBe('EOF');
        expect(tokens.length).toBe(2);
      }
    ));
  });

  it('produces NUMBER tokens for decimal input with consistent parseFloat values', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 9999 }),
      fc.integer({ min: 0, max: 9999 }),
      (int, frac) => {
        const str = `${int}.${String(frac).padStart(1, '0')}`;
        const n = parseFloat(str);
        const lexer = new PegaExpressionLexer(str);
        const tokens = lexer.tokenize();
        expect(tokens[0].type).toBe('NUMBER');
        expect(parseFloat(tokens[0].value)).toBeCloseTo(n, 5);
        expect(tokens[0].value).toBe(str);
      }
    ));
  });

  it('produces STRING tokens for string literals with preserved value', () => {
    fc.assert(fc.property(
      fc.string({ min: 0, max: 15 }).filter(isSimpleString),
      (s) => {
        const lexer = new PegaExpressionLexer(`"${s}"`);
        const tokens = lexer.tokenize();
        expect(tokens[0].type).toBe('STRING');
        expect(tokens[0].value).toBe(s);
        expect(tokens[tokens.length - 1].type).toBe('EOF');
      }
    ));
  });

  it('produces DOT and IDENTIFIER tokens for property references with correct name', () => {
    fc.assert(fc.property(
      fc.string({ min: 1, max: 20 }).filter(isValidIdentifier),
      (name) => {
        const lexer = new PegaExpressionLexer(`.${name}`);
        const tokens = lexer.tokenize();
        expect(tokens[0].type).toBe('DOT');
        expect(tokens[1].type).toBe('IDENTIFIER');
        expect(tokens[1].value).toBe(name);
        expect(tokens[tokens.length - 1].type).toBe('EOF');
      }
    ));
  });

  it('recognizes keyword tokens .AND. .OR. .NOT. .ISNULL with correct types', () => {
    const keywordPairs: [string, string][] = [
      ['.AND.', 'AND'],
      ['.OR.', 'OR'],
      ['.NOT.', 'NOT'],
      ['.ISNULL', 'ISNULL'],
    ];
    fc.assert(fc.property(
      fc.constantFrom(...keywordPairs),
      ([keyword, expectedType]) => {
        const lexer = new PegaExpressionLexer(keyword);
        const tokens = lexer.tokenize();
        expect(tokens[0].type).toBe(expectedType);
        expect(tokens[0].value).toBe(keyword);
        expect(tokens[tokens.length - 1].type).toBe('EOF');
      }
    ));
  });

  it('recognizes comparison operators = <> > < >= <= with correct types', () => {
    const operatorPairs: [string, string][] = [
      ['=', 'EQ'],
      ['<>', 'NEQ'],
      ['>', 'GT'],
      ['<', 'LT'],
      ['>=', 'GTE'],
      ['<=', 'LTE'],
    ];
    fc.assert(fc.property(
      fc.constantFrom(...operatorPairs),
      ([op, expectedType]) => {
        const lexer = new PegaExpressionLexer(`.a ${op} .b`);
        const tokens = lexer.tokenize();
        const opToken = tokens.find(t => t.type === expectedType);
        expect(opToken).toBeDefined();
        expect(opToken!.type).toBe(expectedType);
      }
    ));
  });

  it('recognizes true and false as IDENTIFIER tokens', () => {
    fc.assert(fc.property(
      fc.constantFrom('true', 'false'),
      (s) => {
        const lexer = new PegaExpressionLexer(s);
        const tokens = lexer.tokenize();
        expect(tokens[0].type).toBe('IDENTIFIER');
        expect(tokens[0].value).toBe(s);
        expect(tokens[tokens.length - 1].type).toBe('EOF');
      }
    ));
  });

  it('tokenizes FUNCTION tokens with @ prefix preserved', () => {
    fc.assert(fc.property(
      fc.string({ min: 1, max: 15 }).filter(isValidIdentifier),
      (name) => {
        const lexer = new PegaExpressionLexer(`@${name}()`);
        const tokens = lexer.tokenize();
        expect(tokens[0].type).toBe('FUNCTION');
        expect(tokens[0].value).toBe(`@${name}`);
      }
    ));
  });
});

describe('Parser properties', () => {

  it('parses .identifier to PropertyRefNode with correct parts', () => {
    fc.assert(fc.property(
      fc.string({ min: 1, max: 15 }).filter(isValidIdentifier),
      (name) => {
        const ast = parser.parse(`.${name}`);
        expect(ast).toBeInstanceOf(PropertyRefNode);
        expect((ast as PropertyRefNode).parts).toEqual([name]);
      }
    ));
  });

  it('parses chained property ref .a.b.c to PropertyRefNode with all parts', () => {
    fc.assert(fc.property(
      fc.array(fc.string({ min: 1, max: 8 }).filter(isValidIdentifier), { minLength: 2, maxLength: 5 }),
      (parts) => {
        const expr = '.' + parts.join('.');
        const ast = parser.parse(expr);
        expect(ast).toBeInstanceOf(PropertyRefNode);
        expect((ast as PropertyRefNode).parts).toEqual(parts);
      }
    ));
  });

  it('parses number literal to NumberLiteralNode with correct value', () => {
    fc.assert(fc.property(
      fc.nat({ max: 999999 }),
      (n) => {
        const ast = parser.parse(String(n));
        expect(ast).toBeInstanceOf(NumberLiteralNode);
        expect((ast as NumberLiteralNode).value).toBe(n);
      }
    ));
  });

  it('parses string literal to StringLiteralNode with correct value', () => {
    fc.assert(fc.property(
      fc.string({ min: 0, max: 10 }).filter(isSimpleString),
      (s) => {
        const ast = parser.parse(`"${s}"`);
        expect(ast).toBeInstanceOf(StringLiteralNode);
        expect((ast as StringLiteralNode).value).toBe(s);
      }
    ));
  });

  it('parses boolean literals true and false to BooleanLiteralNode', () => {
    fc.assert(fc.property(
      fc.boolean(),
      (b) => {
        const ast = parser.parse(String(b));
        expect(ast).toBeInstanceOf(BooleanLiteralNode);
        expect((ast as BooleanLiteralNode).value).toBe(b);
      }
    ));
  });

  it('parses comparison .a = .b to BinaryOpNode with EQ operator', () => {
    fc.assert(fc.property(
      fc.string({ min: 1, max: 10 }).filter(isValidIdentifier),
      fc.string({ min: 1, max: 10 }).filter(isValidIdentifier),
      (left, right) => {
        const ast = parser.parse(`.${left} = .${right}`);
        expect(ast).toBeInstanceOf(BinaryOpNode);
        expect((ast as BinaryOpNode).operator).toBe('EQ');
        expect((ast as BinaryOpNode).left).toBeInstanceOf(PropertyRefNode);
        expect((ast as BinaryOpNode).right).toBeInstanceOf(PropertyRefNode);
      }
    ));
  });

  it('parses .NOT. .a > 5 with NOT binding around comparison', () => {
    const ast = parser.parse('.NOT. .Amount > 5');
    expect(ast).toBeInstanceOf(UnaryOpNode);
    const unary = ast as UnaryOpNode;
    expect(unary.operator).toBe('NOT');
    expect(unary.operand).toBeInstanceOf(BinaryOpNode);
    const binary = unary.operand as BinaryOpNode;
    expect(binary.operator).toBe('GT');
    expect(binary.left).toBeInstanceOf(PropertyRefNode);
    expect((binary.left as PropertyRefNode).parts).toEqual(['Amount']);
    expect(binary.right).toBeInstanceOf(NumberLiteralNode);
    expect((binary.right as NumberLiteralNode).value).toBe(5);
  });

  it('parses parenthesized expression maintaining structure', () => {
    const withoutParens = parser.parse('.Amount > 5 .AND. .Priority = "High"');
    const withParens = parser.parse('.Amount > 5 .AND. (.Priority = "High")');
    expect(withoutParens).toBeInstanceOf(BinaryOpNode);
    expect(withParens).toBeInstanceOf(BinaryOpNode);
    const b1 = withoutParens as BinaryOpNode;
    const b2 = withParens as BinaryOpNode;
    expect(b1.operator).toBe('AND');
    expect(b2.operator).toBe('AND');
    expect(b1.left).toBeInstanceOf(BinaryOpNode);
    expect(b2.left).toBeInstanceOf(BinaryOpNode);
    expect(b1.right).toBeInstanceOf(BinaryOpNode);
    expect(b2.right).toBeInstanceOf(BinaryOpNode);
  });

  it('parses function call @name(...) to FunctionCallNode with correct name', () => {
    fc.assert(fc.property(
      fc.string({ min: 1, max: 12 }).filter(isValidIdentifier),
      fc.array(fc.nat({ max: 99 }), { minLength: 0, maxLength: 4 }),
      (name, args) => {
        const argStr = args.length > 0 ? args.map(String).join(', ') : '';
        const expr = `@${name}(${argStr})`;
        const ast = parser.parse(expr);
        expect(ast).toBeInstanceOf(FunctionCallNode);
        expect((ast as FunctionCallNode).name).toBe(`@${name}`);
        expect((ast as FunctionCallNode).args.length).toBe(args.length);
      }
    ));
  });
});

describe('Evaluator properties', () => {

  it('evaluates property reference to the value stored in clipboard', () => {
    fc.assert(fc.property(
      fc.string({ min: 0, max: 10 }).filter(isSimpleString),
      fc.string({ min: 1, max: 10 }).filter(isValidIdentifier),
      (propValue, propName) => {
        const ctx = new PegaClipboardContext({
          pyWorkPage: {
            [propName]: { type: 'Text', value: propValue },
          },
        });
        const result = evaluator.evaluate(`.${propName}`, ctx);
        expect(result.value.text).toBe(propValue);
        expect(result.value.type).toBe('Text');
      }
    ));
  });

  it('evaluates @upper(@lower(x)) preserving length', () => {
    fc.assert(fc.property(
      fc.string({ min: 0, max: 20 }).filter(isSimpleString),
      (s) => {
        const ctx = new PegaClipboardContext({
          pyWorkPage: {
            Name: { type: 'Text', value: s },
          },
        });
        const lowerResult = evaluator.evaluate('@lower(.Name)', ctx);
        const upperResult = evaluator.evaluate('@upper(.Name)', ctx);
        expect(lowerResult.value.text).toBe(s.toLowerCase());
        expect(upperResult.value.text).toBe(s.toUpperCase());

        const doubleUpper = evaluator.evaluate('@upper(@lower(.Name))', ctx);
        const doubleLower = evaluator.evaluate('@lower(@upper(.Name))', ctx);
        expect(doubleUpper.value.text.length).toBe(s.length);
        expect(doubleLower.value.text.length).toBe(s.length);
        expect(doubleUpper.value.text).toBe(s.toUpperCase());
        expect(doubleLower.value.text).toBe(s.toLowerCase());

        expect(doubleUpper.value.text).toBe(upperResult.value.text);
        expect(doubleLower.value.text).toBe(lowerResult.value.text);
      }
    ));
  });

  it('evaluates @If(trueCondition, valA, valB) to valA', () => {
    fc.assert(fc.property(
      fc.string({ min: 0, max: 10 }).filter(isSimpleString),
      fc.string({ min: 0, max: 10 }).filter(isSimpleString),
      (a, b) => {
        const ctx = new PegaClipboardContext({ pyWorkPage: {} });
        const result = evaluator.evaluate(`@If(true, "${a}", "${b}")`, ctx);
        expect(result.value.text).toBe(a);
      }
    ));
  });

  it('evaluates @If(falseCondition, valA, valB) to valB', () => {
    fc.assert(fc.property(
      fc.string({ min: 0, max: 10 }).filter(isSimpleString),
      fc.string({ min: 0, max: 10 }).filter(isSimpleString),
      (a, b) => {
        const ctx = new PegaClipboardContext({ pyWorkPage: {} });
        const result = evaluator.evaluate(`@If(false, "${a}", "${b}")`, ctx);
        expect(result.value.text).toBe(b);
      }
    ));
  });

  it('evaluates @Concat(a, b) to a + b', () => {
    fc.assert(fc.property(
      fc.string({ min: 0, max: 8 }).filter(isSimpleString),
      fc.string({ min: 0, max: 8 }).filter(isSimpleString),
      (a, b) => {
        const ctx = new PegaClipboardContext({ pyWorkPage: {} });
        const result = evaluator.evaluate(`@Concat("${a}", "${b}")`, ctx);
        expect(result.value.text).toBe(a + b);
        expect(result.value.type).toBe('Text');
      }
    ));
  });

  it('evaluates .ISNULL correctly: null value returns true, non-null returns false', () => {
    fc.assert(fc.property(
      fc.boolean(),
      fc.string({ min: 0, max: 8 }).filter(isSimpleString),
      (hasValue, propValue) => {
        const propData = hasValue
          ? { type: 'Text', value: propValue }
          : null;
        const ctx = new PegaClipboardContext({
          pyWorkPage: {
            TestProp: propData as any,
          },
        });
        const result = evaluator.evaluate('.ISNULL .TestProp', ctx);
        expect(result.value.boolean).toBe(!hasValue);
        expect(result.value.type).toBe('Boolean');
      }
    ));
  });

  it('evaluates @round preserving integer identity', () => {
    fc.assert(fc.property(
      fc.integer({ min: -9999, max: 9999 }),
      (n) => {
        const ctx = new PegaClipboardContext({
          pyWorkPage: {
            Value: { type: 'Number', value: n },
          },
        });
        const result = evaluator.evaluate('@round(.Value)', ctx);
        expect(result.value.number).toBe(n);
        expect(result.value.type).toBe('Number');
      }
    ));
  });

  it('evaluates @Length matching string length', () => {
    fc.assert(fc.property(
      fc.string({ min: 0, max: 30 }).filter(isSimpleString),
      (s) => {
        const ctx = new PegaClipboardContext({
          pyWorkPage: {
            TextVal: { type: 'Text', value: s },
          },
        });
        const result = evaluator.evaluate('@Length(.TextVal)', ctx);
        expect(result.value.number).toBe(s.length);
      }
    ));
  });

  it('evaluates numeric comparison operators correctly', () => {
    fc.assert(fc.property(
      fc.integer({ min: -100, max: 100 }),
      fc.integer({ min: -100, max: 100 }),
      (a, b) => {
        const ctx = new PegaClipboardContext({
          pyWorkPage: {
            A: { type: 'Number', value: a },
            B: { type: 'Number', value: b },
          },
        });
        expect(evaluator.evaluate('.A = .B', ctx).value.boolean).toBe(a === b);
        expect(evaluator.evaluate('.A <> .B', ctx).value.boolean).toBe(a !== b);
        expect(evaluator.evaluate('.A > .B', ctx).value.boolean).toBe(a > b);
        expect(evaluator.evaluate('.A < .B', ctx).value.boolean).toBe(a < b);
        expect(evaluator.evaluate('.A >= .B', ctx).value.boolean).toBe(a >= b);
        expect(evaluator.evaluate('.A <= .B', ctx).value.boolean).toBe(a <= b);
      }
    ));
  });
});

describe('ClipboardContext properties', () => {

  it('resolves single-part property preserving value across all primitive types', () => {
    fc.assert(fc.property(
      fc.string({ min: 0, max: 10 }).filter(isSimpleString),
      fc.integer({ min: -999, max: 999 }),
      fc.boolean(),
      (textVal, numVal, boolVal) => {
        const ctx = new PegaClipboardContext({
          pyWorkPage: {
            TextProp: textVal,
            NumProp: numVal,
            BoolProp: boolVal,
          },
        });
        expect(ctx.resolve(['TextProp']).text).toBe(textVal);
        expect(ctx.resolve(['TextProp']).type).toBe('Text');
        expect(ctx.resolve(['NumProp']).number).toBe(numVal);
        expect(ctx.resolve(['NumProp']).type).toBe('Number');
        expect(ctx.resolve(['BoolProp']).boolean).toBe(boolVal);
        expect(ctx.resolve(['BoolProp']).type).toBe('Boolean');
      }
    ));
  });

  it('resolves nested page property via chained paths', () => {
    fc.assert(fc.property(
      fc.string({ min: 0, max: 8 }).filter(isSimpleString),
      fc.string({ min: 0, max: 8 }).filter(isSimpleString),
      fc.string({ min: 1, max: 8 }).filter(isValidIdentifier),
      fc.string({ min: 1, max: 8 }).filter(isValidIdentifier),
      (innerVal, outerVal, innerProp, outerProp) => {
        const ctx = new PegaClipboardContext({
          pyWorkPage: {
            [outerProp]: {
              [innerProp]: { type: 'Text', value: innerVal },
            },
            Other: { type: 'Text', value: outerVal },
          },
        });
        const nested = ctx.resolve([outerProp, innerProp]);
        expect(nested.text).toBe(innerVal);
        expect(nested.type).toBe('Text');
        const top = ctx.resolve(['Other']);
        expect(top.text).toBe(outerVal);
      }
    ));
  });

  it('resolves absolute vs relative paths consistently', () => {
    fc.assert(fc.property(
      fc.string({ min: 1, max: 8 }).filter(isSimpleString),
      fc.string({ min: 1, max: 8 }).filter(isValidIdentifier),
      (propValue, propName) => {
        const ctx = new PegaClipboardContext({
          pyWorkPage: {
            [propName]: { type: 'Text', value: propValue },
          },
        });
        const relative = ctx.resolve([propName]);
        const absolute = ctx.resolve(['pyWorkPage', propName]);
        expect(relative.text).toBe(propValue);
        expect(absolute.text).toBe(propValue);
        expect(relative.text).toBe(absolute.text);
      }
    ));
  });
});
