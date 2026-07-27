# TASK — Work Package 3: Decision Table/Tree Evaluator

## 1. Summary

Evaluate Pega decision logic (`Rule-Declare-DecisionTable`, `Rule-Declare-DecisionTree`) against input values. Decision tables iterate rows in priority order matching conditions; decision trees traverse conditional branches to leaf results. Both use WP1 expression evaluator for custom predicate conditions.

Reference: [Upgrade Plan §5](../SA4E-56/pega-parser-upgrade-plan.md#5-work-package-3-decision-tabletree-evaluator)

## 2. Scope

### 2.1 Decision Table Condition Operators

| Operator | Syntax | Description |
|----------|--------|-------------|
| Exact match | `Property = "value"` | Equality comparison |
| Not equal | `Property <> "value"` | Inequality |
| Range | `Property >= 100 .AND. Property < 200` | Inclusive/exclusive bounds |
| Greater/less | `Property > 50`, `Property < 100` | Comparison |
| Set membership | `Property IN ("A", "B", "C")` | Value in list |
| Negation | `Property NOT IN ("X", "Y")` | Value NOT in list |
| Null check | `Property IS NULL`, `Property IS BLANK` | Null/empty |
| Custom predicate | Arbitrary expression text | Delegated to WP1 expression evaluator |

### 2.2 Decision Tree Behavior
- Start at root node, evaluate node condition
- Follow matching child branch (condition result → branch key)
- Repeat until leaf node reached → return result value
- Depth limit: 50 (configurable, default 50)
- Fallthrough: no branch matches → return error

### 2.3 Strategy Component Resolution
- Resolve references to other decision rules
- Handle adaptive model references (stub: return `NotImplemented` error)
- Lazy evaluation: only fetch when referenced during evaluation

## 3. Components

| Component | File | Responsibility |
|-----------|------|----------------|
| **PegaDecisionTableEvaluator** | `backend/src/modules/pega/decision/PegaDecisionTableEvaluator.ts` | Iterate rows in priority, match conditions, return first match |
| **PegaDecisionTreeEvaluator** | `backend/src/modules/pega/decision/PegaDecisionTreeEvaluator.ts` | Recursive tree traversal evaluating conditions, following branches to leaf |
| **PegaDecisionConditionParser** | `backend/src/modules/pega/decision/PegaDecisionConditionParser.ts` | Parse row/node condition string → condition AST with operator + operands |
| **PegaConditionOperatorRegistry** | `backend/src/modules/pega/decision/PegaConditionOperatorRegistry.ts` | Registry of operator handlers; pluggable for extensibility |
| **PegaEvaluationResult** | `backend/src/modules/pega/decision/PegaEvaluationResult.ts` | Result: matched row ID, output value, trace path of evaluated rows |
| **PegaStrategyComponentResolver** | `backend/src/modules/pega/decision/PegaStrategyComponentResolver.ts` | Resolve strategy references to other decision rules/adaptive models |

## 4. Effort: 6 person-weeks

| Activity | Weeks | Dependencies |
|----------|-------|-------------|
| Condition operator framework (core + equals, in, range, null) | 1.5 | WP1 for predicate parsing |
| Decision table evaluator | 1.5 | Condition framework |
| Decision tree evaluator | 1 | Condition framework |
| Strategy component resolver | 1 | Decision evaluators |
| Result tracing + error handling | 1 | All evaluators |

## 5. Dependencies

| Dependency | Type | Notes |
|-----------|------|-------|
| WP1 — Expression Language Parser | Strong | Condition predicates parsed as expressions; custom predicates evaluated |
| `PegaRuleAstParser` (existing) | Internal | Row/node data extraction already works |
| Sample Decision table/tree JSON | External | Rows with various condition operators |

## 6. Out of Scope
- Adaptive Decision Model execution (L5 scope per Risk R10)
- Scorecard evaluation (requires ML runtime)
- Decision table optimization (indexing, pre-filtering)