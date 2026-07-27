import type { PegaClipboardContext } from './PegaClipboardContext.js';

export type ValueType = 'Text' | 'Number' | 'Boolean' | 'Null' | 'Page' | 'PageList';

export class PegValue {
  constructor(
    public readonly type: ValueType,
    public readonly value: unknown,
  ) {}

  get text(): string {
    if (this.type === 'Null') return '';
    if (this.type === 'Number') return String(this.value);
    if (this.type === 'Boolean') return this.value ? 'true' : 'false';
    return String(this.value ?? '');
  }

  get number(): number {
    if (this.type === 'Number') return this.value as number;
    if (this.type === 'Text') {
      const n = Number(this.value);
      return isNaN(n) ? 0 : n;
    }
    return 0;
  }

  get boolean(): boolean {
    if (this.type === 'Boolean') return this.value as boolean;
    if (this.type === 'Null') return false;
    if (this.type === 'Number') return (this.value as number) !== 0;
    return this.value != null && this.value !== '';
  }

  static text(v: string): PegValue { return new PegValue('Text', v); }
  static number(v: number): PegValue { return new PegValue('Number', v); }
  static bool(v: boolean): PegValue { return new PegValue('Boolean', v); }
  static null(): PegValue { return new PegValue('Null', null); }
  static page(name: string, ctx: PegaClipboardContext): PegValue { return new PegValue('Page', { name, ctx }); }
  static pageList(items: PegValue[]): PegValue { return new PegValue('PageList', items); }
}

export type ExpressionNodeType =
  | 'PropertyRef'
  | 'FunctionCall'
  | 'StringLiteral'
  | 'NumberLiteral'
  | 'BooleanLiteral'
  | 'NullLiteral'
  | 'BinaryOp'
  | 'UnaryOp';

export type BinaryOperator = 'AND' | 'OR' | 'EQ' | 'NEQ' | 'GT' | 'LT' | 'GTE' | 'LTE';
export type UnaryOperator = 'NOT' | 'ISNULL';

export interface ExpressionAstNode {
  nodeType: ExpressionNodeType;
  evaluate(context: PegaClipboardContext): PegValue;
}

export class PropertyRefNode implements ExpressionAstNode {
  readonly nodeType: ExpressionNodeType = 'PropertyRef';
  constructor(public readonly parts: string[]) {}

  evaluate(context: PegaClipboardContext): PegValue {
    return context.resolve(this.parts);
  }
}

export class FunctionCallNode implements ExpressionAstNode {
  readonly nodeType: ExpressionNodeType = 'FunctionCall';
  constructor(
    public readonly name: string,
    public readonly args: ExpressionAstNode[],
  ) {}

  evaluate(context: PegaClipboardContext): PegValue {
    const evaledArgs = this.args.map(a => a.evaluate(context));
    return PegaBuiltinFunctions.call(this.name, evaledArgs);
  }
}

export class StringLiteralNode implements ExpressionAstNode {
  readonly nodeType: ExpressionNodeType = 'StringLiteral';
  constructor(public readonly value: string) {}

  evaluate(_context: PegaClipboardContext): PegValue {
    return PegValue.text(this.value);
  }
}

export class NumberLiteralNode implements ExpressionAstNode {
  readonly nodeType: ExpressionNodeType = 'NumberLiteral';
  constructor(public readonly value: number) {}

  evaluate(_context: PegaClipboardContext): PegValue {
    return PegValue.number(this.value);
  }
}

export class BooleanLiteralNode implements ExpressionAstNode {
  readonly nodeType: ExpressionNodeType = 'BooleanLiteral';
  constructor(public readonly value: boolean) {}

  evaluate(_context: PegaClipboardContext): PegValue {
    return PegValue.bool(this.value);
  }
}

export class NullLiteralNode implements ExpressionAstNode {
  readonly nodeType: ExpressionNodeType = 'NullLiteral';

  evaluate(_context: PegaClipboardContext): PegValue {
    return PegValue.null();
  }
}

export class BinaryOpNode implements ExpressionAstNode {
  readonly nodeType: ExpressionNodeType = 'BinaryOp';
  constructor(
    public readonly operator: BinaryOperator,
    public readonly left: ExpressionAstNode,
    public readonly right: ExpressionAstNode,
  ) {}

  evaluate(context: PegaClipboardContext): PegValue {
    const l = this.left.evaluate(context);
    const r = this.right.evaluate(context);

    switch (this.operator) {
      case 'AND': return PegValue.bool(l.boolean && r.boolean);
      case 'OR': return PegValue.bool(l.boolean || r.boolean);
      case 'EQ': return PegValue.bool(l.text === r.text);
      case 'NEQ': return PegValue.bool(l.text !== r.text);
      case 'GT': return PegValue.bool(l.number > r.number);
      case 'LT': return PegValue.bool(l.number < r.number);
      case 'GTE': return PegValue.bool(l.number >= r.number);
      case 'LTE': return PegValue.bool(l.number <= r.number);
    }
  }
}

export class UnaryOpNode implements ExpressionAstNode {
  readonly nodeType: ExpressionNodeType = 'UnaryOp';
  constructor(
    public readonly operator: UnaryOperator,
    public readonly operand: ExpressionAstNode,
  ) {}

  evaluate(context: PegaClipboardContext): PegValue {
    const v = this.operand.evaluate(context);
    switch (this.operator) {
      case 'NOT': return PegValue.bool(!v.boolean);
      case 'ISNULL': return PegValue.bool(v.type === 'Null');
    }
  }
}

export class PegaBuiltinFunctions {
  private static whitelist = new Map<string, (args: PegValue[]) => PegValue>([
    ['@round', (args) => {
      const n = args[0].number;
      const decimals = args.length > 1 ? args[1].number : 0;
      const factor = Math.pow(10, decimals);
      return PegValue.number(Math.round(n * factor) / factor);
    }],
    ['@upper', (args) => PegValue.text(args[0].text.toUpperCase())],
    ['@lower', (args) => PegValue.text(args[0].text.toLowerCase())],
    ['@CurrentDate', () => PegValue.text(new Date().toISOString())],
    ['@If', (args) => args[0].boolean ? args[1] : args[2]],
    ['@IsNull', (args) => PegValue.bool(args[0].type === 'Null')],
    ['@Length', (args) => PegValue.number(args[0].text.length)],
    ['@Concat', (args) => PegValue.text(args.map(a => a.text).join(''))],
    ['@Substring', (args) => {
      const s = args[0].text;
      const start = args[1].number;
      const len = args.length > 2 ? args[2].number : s.length;
      return PegValue.text(s.substring(start, start + len));
    }],
    ['@Index', (args) => PegValue.number(args[0].text.indexOf(args[1].text))],
  ]);

  static isWhitelisted(name: string): boolean {
    return this.whitelist.has(name);
  }

  static call(name: string, args: PegValue[]): PegValue {
    const fn = this.whitelist.get(name);
    if (!fn) {
      throw new PegExpressionError("Function '" + name + "' is not in whitelist", 'FUNCTION_NOT_ALLOWED', 0, 0);
    }
    return fn(args);
  }
}

export class PegExpressionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly line?: number,
    public readonly column?: number,
  ) {
    super(message);
    this.name = 'PegExpressionError';
  }
}
