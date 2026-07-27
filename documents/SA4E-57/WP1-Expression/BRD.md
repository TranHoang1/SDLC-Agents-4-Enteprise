# BRD — Work Package 1: Expression Language Parser

## 1. Business Context

Pega Platform uses a proprietary clipboard expression language across nearly every rule type: Property-Set/Get steps, When conditions, Decision Table rows, Constraint rules, Data Transform mappings, and Section visibility conditions. The current L1-L2 parser treats all expression strings as opaque text. L3-L4 requires full parse → evaluate capability.

This WP delivers the foundational component that WP2 (Workflow), WP3 (Decision), and WP4 (UI) all depend on.

Reference: [Upgrade Plan §3](../SA4E-56/pega-parser-upgrade-plan.md#3-work-package-1-expression-language-parser)

## 2. Grammar Coverage

### 2.1 Property References
- Simple: `.PropertyName`
- Chained: `.Page.SubPage.Property`
- Absolute: `pyWorkPage.Order.Total`
- Context-relative (current page scope)
- Parameterized: `.Param.Property`

### 2.2 Literals
- String: `"double quoted"`, `'single quoted'`
- Number: integer `123`, decimal `45.67`, negative `-5`
- Boolean: `true`, `false` (via When conditions)
- Null: `@NULL`, `.ISNULL`

### 2.3 Functions (@functions)
| Function | Signature | Description |
|----------|-----------|-------------|
| `@round` | `@round(number, decimals?)` | Round numeric value |
| `@upper` | `@upper(string)` | Uppercase string |
| `@lower` | `@lower(string)` | Lowercase string |
| `@CurrentDate` | `@CurrentDate()` | Current date/time |
| `@If` | `@If(cond, then, else)` | Conditional |
| `@IsNull` | `@IsNull(value)` | Null check |
| `@Length` | `@Length(string)` | String length |
| `@Concat` | `@Concat(str1, str2, ...)` | String concatenation |
| `@Substring` | `@Substring(str, start, len)` | Substring extraction |
| `@Index` | `@Index(string, search)` | Index of substring |

### 2.4 Operators
- Boolean: `.AND.`, `.OR.`, `.NOT.`
- Comparison: `=`, `<>`, `>`, `<`, `>=`, `<=`
- Null: `.ISNULL` (postfix)
- Precedence: `()` > `.NOT.` > comparison > `.AND.` > `.OR.`

### 2.5 Grammar (from Upgrade Plan §3.6)

```
expression       → logical-expression ( ".OR." logical-expression )*
logical-expression → comparison ( ".AND." comparison )*
comparison       → value ( ( "=" | "<>" | ">" | "<" | ">=" | "<=" ) value )?
value            → property-ref | STRING | NUMBER | function-call
                 | "(" expression ")" | ".NOT." value | ".ISNULL" value
function-call    → "@" IDENTIFIER "(" ( expression ( "," expression )* )? ")"
property-ref     → "." IDENTIFIER ( "." IDENTIFIER )*
                 | IDENTIFIER ( "." IDENTIFIER )+
```

## 3. Components

| Component | File | Responsibility |
|-----------|------|----------------|
| **PegaExpressionLexer** | `backend/src/modules/pega/expression/PegaExpressionLexer.ts` | Tokenize expression strings: DOT, IDENTIFIER, STRING, NUMBER, OPERATOR, FUNCTION, LPAREN, RPAREN, AND, OR, NOT, ISNULL |
| **PegaExpressionParser** | `backend/src/modules/pega/expression/PegaExpressionParser.ts` | Recursive descent parser; consumes tokens → ExpressionAst; error reporting with line/column |
| **PegaExpressionAst** | `backend/src/modules/pega/expression/PegaExpressionAst.ts` | AST node types: PropertyRef, FunctionCall, StringLiteral, NumberLiteral, BinaryOp, UnaryOp, NullLiteral |
| **PegaExpressionEvaluator** | `backend/src/modules/pega/expression/PegaExpressionEvaluator.ts` | Walk AST, evaluate against ClipboardContext, return Value; each node implements `evaluate(ctx): Value` |
| **PegaClipboardContext** | `backend/src/modules/pega/expression/PegaClipboardContext.ts` | Tree of pages/values: `Map<string, Value>` with parent reference; resolves `.Prop` relative, `pyWorkPage.Prop` absolute |
| **PegaConstraintEvaluator** | `backend/src/modules/pega/expression/PegaConstraintEvaluator.ts` | Evaluates Declare-Constraint: target property, constraint expression, violation reporting |
| **PegaWhenEvaluator** | `backend/src/modules/pega/expression/PegaWhenEvaluator.ts` | Evaluates When condition rules from `.pyWhenText` or condition structure → boolean |

## 4. User Stories

### US-EXPR-01: Parse Expressions
As a developer, I want to parse Pega expression strings into AST so that the structure of expressions is machine-readable.

**Acceptance:**
- `.Order.Total` → PropertyRef ["Order", "Total"]
- `@round(.Amount, 2)` → FunctionCall("round", [PropertyRef ["Amount"], NumberLiteral(2)])
- `.Status = "Open" .AND. .Amount > 100` → BinaryOp(AND, BinaryOp(=, PropertyRef ["Status"], StringLiteral("Open")), BinaryOp(>, PropertyRef ["Amount"], NumberLiteral(100)))
- Parse errors report line:column and descriptive message

### US-EXPR-02: Evaluate Expressions
As a developer, I want to evaluate parsed expressions against a clipboard context so that I can get actual values.

**Acceptance:**
- `.Customer.Name` with context `{Customer: {Name: "Acme"}}` → "Acme"
- `@upper(.Customer.Name)` → "ACME"
- `.Amount > 100` with Amount=150 → true
- `.Status = "Open" .AND. .Amount > 100` → true/false correctly

### US-EXPR-03: Evaluate Constraints
As a developer, I want to evaluate Declare-Constraint rules against clipboard state to detect violations.

**Acceptance:**
- Constraint `.Total = .Subtotal + .Tax` evaluates correctly
- Violation reported when constraint expression evaluates to false
- Violation includes: property name, expected expression, actual value

### US-EXPR-04: Evaluate When Conditions
As a developer, I want to evaluate When condition rules to boolean so workflow routing and visibility decisions can be made.

**Acceptance:**
- Simple When: `.Status = "Approved"` → true/false
- Compound When: `.Status = "Open" .AND. (.Amount > 100 .OR. .Priority = "High")`
- When with @functions: `@If(.Type = "VIP", .Limit > 1000, .Limit > 500)`

### US-EXPR-05: Error Reporting
As a developer, I want clear error messages from lexer/parser/evaluator so I can debug expression issues quickly.

**Acceptance:**
- Lexer error: "Unexpected character '#' at line 3, column 12"
- Parser error: "Expected '.AND.' or '.OR.' after expression at line 2, column 8"
- Evaluator error: "Function '@unknownFunc' is not in whitelist"
- Evaluator error: "Property '.Missing.Page' not found in clipboard context"

## 5. Effort: 8 person-weeks

| Activity | Weeks | Dependencies |
|----------|-------|-------------|
| Expression pattern research & sample corpus (50+ expressions) | 1 | Access to Pega exports |
| Lexer implementation | 1 | Token type definitions |
| Parser core grammar (property refs, literals, operators) | 2 | Lexer |
| Parser advanced (functions, error recovery, complex) | 1 | Core parser |
| Clipboard context model | 1 | Independent |
| Evaluator implementation | 1 | Parser + Clipboard |
| Constraint & When evaluators | 1 | Expression evaluator |

## 6. Dependencies

| Dependency | Type | Notes |
|-----------|------|-------|
| Pega expression sample corpus (50+ expressions) | External | Real Activity steps, When conditions, Declare-Constraint rules |
| `PegaRuleAst` types | Internal | Expression AST references Rule types for field metadata |
| Property type registry | Internal | Property metadata (Text, Decimal, Boolean, DateTime) |

## 7. Out of Scope
- PEG/jison grammar DSL (hand-written parser only)
- Regex-based expression extraction (all parsing must produce AST)
- Full Pega Platform runtime integration