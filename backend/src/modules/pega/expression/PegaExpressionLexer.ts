import { PegExpressionError } from './PegaExpressionAst.js';

export type TokenType =
  | 'DOT'
  | 'IDENTIFIER'
  | 'STRING'
  | 'NUMBER'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'EQ'
  | 'NEQ'
  | 'GT'
  | 'LT'
  | 'GTE'
  | 'LTE'
  | 'AND'
  | 'OR'
  | 'NOT'
  | 'ISNULL'
  | 'FUNCTION'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

const KEYWORD_PATTERNS: Array<{ value: string; type: TokenType }> = [
  { value: '.AND.', type: 'AND' },
  { value: '.OR.', type: 'OR' },
  { value: '.NOT.', type: 'NOT' },
  { value: '.ISNULL', type: 'ISNULL' },
];

export class PegaExpressionLexer {
  private pos = 0;
  private line = 1;
  private column = 1;
  private tokens: Token[] = [];

  constructor(private input: string) {}

  tokenize(): Token[] {
    this.tokens = [];
    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];

      if (ch === ' ' || ch === '\t' || ch === '\r') {
        this.advance();
        continue;
      }

      if (ch === '\n') {
        this.line++;
        this.column = 1;
        this.pos++;
        continue;
      }

      if (ch === '"' || ch === "'") {
        this.tokens.push(this.readString(ch));
        continue;
      }

      if (ch === '.') {
        const keyword = this.tryReadKeyword();
        if (keyword) {
          this.tokens.push(keyword);
        } else if (this.pos + 1 < this.input.length && isDigit(this.input[this.pos + 1])) {
          this.tokens.push(this.readNumber());
        } else {
          this.tokens.push({ type: 'DOT', value: '.', line: this.line, column: this.column });
          this.advance();
        }
        continue;
      }

      if (ch === '@') {
        this.tokens.push(this.readFunction());
        continue;
      }

      if (ch === '(') {
        this.tokens.push({ type: 'LPAREN', value: '(', line: this.line, column: this.column });
        this.advance();
        continue;
      }

      if (ch === ')') {
        this.tokens.push({ type: 'RPAREN', value: ')', line: this.line, column: this.column });
        this.advance();
        continue;
      }

      if (ch === ',') {
        this.tokens.push({ type: 'COMMA', value: ',', line: this.line, column: this.column });
        this.advance();
        continue;
      }

      if (isDigit(ch) || (ch === '-' && this.pos + 1 < this.input.length && isDigit(this.input[this.pos + 1]))) {
        this.tokens.push(this.readNumber());
        continue;
      }

      if (isAlpha(ch)) {
        this.tokens.push(this.readIdentifier());
        continue;
      }

      if (ch === '=') {
        this.advance();
        if (this.pos < this.input.length && this.input[this.pos] === '>') {
          this.tokens.push({ type: 'GTE', value: '=>', line: this.line, column: this.column - 1 });
          this.advance();
        } else {
          this.tokens.push({ type: 'EQ', value: '=', line: this.line, column: this.column - 1 });
        }
        continue;
      }

      if (ch === '<') {
        this.advance();
        if (this.pos < this.input.length && this.input[this.pos] === '=') {
          this.tokens.push({ type: 'LTE', value: '<=', line: this.line, column: this.column - 1 });
          this.advance();
        } else if (this.pos < this.input.length && this.input[this.pos] === '>') {
          this.tokens.push({ type: 'NEQ', value: '<>', line: this.line, column: this.column - 1 });
          this.advance();
        } else {
          this.tokens.push({ type: 'LT', value: '<', line: this.line, column: this.column - 1 });
        }
        continue;
      }

      if (ch === '>') {
        this.advance();
        if (this.pos < this.input.length && this.input[this.pos] === '=') {
          this.tokens.push({ type: 'GTE', value: '>=', line: this.line, column: this.column - 1 });
          this.advance();
        } else {
          this.tokens.push({ type: 'GT', value: '>', line: this.line, column: this.column - 1 });
        }
        continue;
      }

      throw new PegExpressionError(
        'Unexpected character ' + ch + ' at line ' + this.line + ', column ' + this.column,
        'PARSE_ERROR',
        this.line, this.column,
      );
    }

    this.tokens.push({ type: 'EOF', value: '', line: this.line, column: this.column });
    return this.tokens;
  }

  private tryReadKeyword(): Token | null {
    for (const kw of KEYWORD_PATTERNS) {
      if (this.input.startsWith(kw.value, this.pos)) {
        this.pos += kw.value.length;
        this.column += kw.value.length;
        return { type: kw.type, value: kw.value, line: this.line, column: this.column - kw.value.length };
      }
    }
    return null;
  }

  private advance(): void {
    this.pos++;
    this.column++;
  }

  private readString(quote: string): Token {
    const startCol = this.column;
    const startLine = this.line;
    this.advance();
    let value = '';
    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      if (ch === '\\' && this.pos + 1 < this.input.length) {
        this.advance();
        const next = this.input[this.pos];
        if (next === 'n') value += '\n';
        else if (next === 't') value += '\t';
        else if (next === '\\') value += '\\';
        else if (next === '"') value += '"';
        else if (next === "'") value += "'";
        else value += next;
        this.advance();
        continue;
      }
      if (ch === quote) {
        this.advance();
        return { type: 'STRING', value, line: startLine, column: startCol };
      }
      value += ch;
      this.advance();
    }
    throw new PegExpressionError(
      'Unterminated string literal starting at line ' + startLine + ', column ' + startCol,
      'PARSE_ERROR',
      startLine, startCol,
    );
  }

  private readNumber(): Token {
    const startCol = this.column;
    const startLine = this.line;
    let value = '';
    if (this.input[this.pos] === '-') {
      value += '-';
      this.advance();
    }
    if (this.input[this.pos] === '.') {
      value += '.';
      this.advance();
    }
    while (this.pos < this.input.length && isDigit(this.input[this.pos])) {
      value += this.input[this.pos];
      this.advance();
    }
    if (this.pos < this.input.length && this.input[this.pos] === '.') {
      value += '.';
      this.advance();
      while (this.pos < this.input.length && isDigit(this.input[this.pos])) {
        value += this.input[this.pos];
        this.advance();
      }
    }
    return { type: 'NUMBER', value, line: startLine, column: startCol };
  }

  private readIdentifier(): Token {
    const startCol = this.column;
    const startLine = this.line;
    let value = '';
    while (this.pos < this.input.length && isAlphaNum(this.input[this.pos])) {
      value += this.input[this.pos];
      this.advance();
    }
    return { type: 'IDENTIFIER', value, line: startLine, column: startCol };
  }

  private readFunction(): Token {
    const startCol = this.column;
    const startLine = this.line;
    this.advance();
    let name = '@';
    while (this.pos < this.input.length && isAlphaNum(this.input[this.pos])) {
      name += this.input[this.pos];
      this.advance();
    }
    return { type: 'FUNCTION', value: name, line: startLine, column: startCol };
  }
}

function isDigit(ch: string): boolean { return ch >= '0' && ch <= '9'; }
function isAlpha(ch: string): boolean { return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_'; }
function isAlphaNum(ch: string): boolean { return isAlpha(ch) || isDigit(ch); }
