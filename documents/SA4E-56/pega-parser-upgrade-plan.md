# Pega Parser L3-L4 Upgrade Plan

## Unified Code & Pega Rule Indexing Pipeline — SA4E-56 Extension

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Epic | SA4E-56 |
| Title | Pega Parser Module Upgrade: L1-L2 (Knowledge-Level) to L3-L4 (Execution-Level) |
| Author | Scrum Master Agent (coordination) |
| Version | 1.0 |
| Date | 2026-07-27 |
| Status | Draft |
| Related Documents | BRD-v1-SA4E-56.docx, FSD-v1-SA4E-56.docx, TDD-v1-SA4E-56.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-27 | SM Agent | Initial plan — 6 work packages, prioritization matrix, implementation phases, risk register |

---

## Table of Contents

1. Executive Summary
2. Current Architecture Overview
3. Work Package 1: Expression Language Parser
4. Work Package 2: Workflow Interpreter Engine
5. Work Package 3: Decision Table/Tree Evaluator
6. Work Package 4: Section/Harness UI Preview
7. Work Package 5: Security Hardening
8. Work Package 6: Test Strategy
9. Work Package 7: Deployment & Performance Considerations
10. Prioritization Matrix
11. Implementation Phases (A / B / C)
12. Risk Register
13. Appendix: Current Codebase Analysis

---

## 1. Executive Summary

### 1.1 What L1-L2 Means Today

The Pega parser module currently operates at **knowledge level (L1-L2)**. It can:

- **Read** Pega rule JSON exports and parse them into structured AST (Abstract Syntax Trees)
- **Extract** cross-rule references (calls, when guards, flow-actions, shapes)
- **Normalize** Activity logic into pseudocode text
- **Simulate** rule resolution using pattern inheritance and ruleset stack rules
- **Support** 20+ rule types via specialized AST builders

But the system has **zero semantic understanding**. It treats properties as opaque key-value bags, stores expressions as raw strings, and has no ability to evaluate, execute, or interpret the meaning of any Pega construct.

### 1.2 What L3 (Semantic Understanding) Means

L3 means the parser goes beyond structure to **understand meaning**:

- Parse Pega clipboard expressions into evaluation-ready AST (not just raw strings)
- Understand that `Property-Set .SomePage.SomeProperty value` means "set a property on a clipboard page"
- Resolve property references against a typed clipboard/page model
- Interpret When conditions as executable boolean expressions
- Understand flow shape routing semantics (Assign → Route → Approval chain)
- Read decision table conditions as predicate expressions, not just string columns

### 1.3 What L4 (Execution) Means

L4 means the system can **simulate execution** of Pega logic:

- Evaluate expression AST against a clipboard/page context and produce values
- Execute workflow models: simulate Assign, Route, Approval shapes with work item state tracking
- Evaluate decision tables: match input values against row conditions to produce results
- Render UI sections as HTML previews based on layout + field definitions
- Calculate SLAs and deadlines from flow configuration
- Execute When conditions against clipboard state to determine boolean outcomes

### 1.4 Scope Boundaries

| In Scope | Out of Scope |
|----------|-------------|
| Pega clipboard expression parsing and evaluation | Connecting to a real Pega Platform runtime |
| Workflow shape simulation (routing, assignment, SLA) | Running actual work items through Pega |
| Decision table/tree evaluation against input values | Adaptive Decision Model execution |
| UI section layout rendering to HTML preview | Full pixel-perfect Pega UI rendering |
| Security sandbox for expression execution | Access policy enforcement in production |
| Test strategy for all new evaluation capabilities | Performance benchmarking against Pega Platform |

### 1.5 Total Effort Estimate

| Phase | Work Packages | Effort (Person-Weeks) |
|-------|--------------|----------------------|
| Phase A (Foundation) | WP1, WP5, WP7 | 14 |
| Phase B (Execution) | WP2, WP3 | 16 |
| Phase C (Experience) | WP4, WP6 | 12 |
| **Total** | **7 Work Packages** | **42** |

---

## 2. Current Architecture Overview

### 2.1 Current Component Map

```
backend/src/modules/pega/
├── PegaRuleAst.ts                    # AST interfaces (PegaRuleAst, AstNode, AstReference)
├── PegaRuleAstParser.ts              # 20+ builder methods, reference extraction (508 lines)
├── PegaLogicNormalizer.ts            # Activity/DT → pseudocode (93 lines)
├── PegaRuleResolver.ts               # Pattern inheritance + ruleset simulation (66 lines)
├── PegaDeclarativeEngine.ts          # Forward/backward chaining graph (53 lines)
├── PegaCrawler.ts                    # BFS crawl orchestration (217 lines)
├── PegaParser.ts                     # Unified entry point (57 lines)
├── PegaSchemaLoader.ts               # 76 auto-generated + 173 rule-type schemas
├── PegaRuleFetcherService.ts         # Fetch rules from Pega Platform
├── PegaProjectDetector.ts            # Detect Pega projects in workspace
├── PegaActionPlanGenerator.ts        # Browser automation plans (88 lines)
├── PegaService.ts                    # Service layer
├── models.ts                         # Types: UnresolvedDependency, crawl request/response
├── domain/                           # Domain model (PegaRule, PegaObject, factory)
│   ├── PegaRule.ts                   # Abstract rule base class
│   ├── PegaObject.ts                 # Base object
│   ├── PegaObjectFactory.ts          # Factory pattern for rule type → class
│   ├── PegaActivityRule.ts           # Activity rule model
│   ├── PegaDataTransformRule.ts      # Data transform model
│   ├── PegaGenericRule.ts            # Generic fallback model
│   └── PegaData.ts                   # Data model
└── strategies/                       # Strategy pattern for rule parsing
    ├── PegaParserRegistry.ts
    ├── IPegaRuleParserStrategy.ts
    ├── DefaultPegaParserStrategy.ts
    ├── ActivityParserStrategy.ts
    ├── DataTransformParserStrategy.ts
    └── KbDrivenPegaParserStrategy.ts
```

### 2.2 Key Gaps (Current L1-L2 vs Target L3-L4)

| Capability | Current (L1-L2) | Target (L3-L4) | Gap Size |
|-----------|-----------------|----------------|----------|
| Expression Parsing | `pyMethodParameters` stored as raw string | Parse into Expression AST with operators, functions, property refs | Large |
| Property Resolution | String references to `.Page.Property` | Resolve against typed clipboard/page model | Large |
| Workflow Semantics | Flow shapes parsed but opaque | Understand routing, assignment, SLA behavior | Large |
| Decision Tables | Rows parsed but unevaluated | Match conditions, produce results | Medium |
| Decision Trees | Nodes parsed but not traversable | Traverse branches, reach leaf results | Medium |
| UI Rendering | Layout containers parsed but not rendered | Generate HTML previews | Large |
| When Conditions | Stored as reference string | Evaluate boolean expression against clipboard | Medium |
| Constraint Rules | Raw `.pyConstraint` string | Evaluate constraint expressions | Medium |
| Security | Basic file path validation | Expression sandbox, HTML sanitization, timeout guards | Medium |

---

## 3. Work Package 1: Expression Language Parser

### 3.1 Area

Pega clipboard expression language — the grammar used in Property-Set, Property-Get, When conditions, constraint rules, decision table conditions, and data transform source/target expressions.

### 3.2 Current Capability (L1-L2)

- `pyMethodParameters` values stored as raw strings (e.g., `.Order.TotalAmount`, `.Customer.Name`)
- When conditions extracted as references (`pyWhenCondition` string → resolves to When rule name, but NOT evaluated)
- Constraint rules (Declare-Constraint) `.pyConstraint` field stored as opaque string
- No representation of expression structure — parser sees only text, no semantics
- `PegaLogicNormalizer.ts` converts Activity steps to pseudocode but never parses/understands expression strings
- `PegaDeclarativeEngine.ts` manages property dependency chains but only at the formula label level — formulas are stored but never parsed

### 3.3 Target Capability (L3-L4)

- Parse Pega clipboard expression grammar into a typed `ExpressionAst`:
  - Property references: `.Property`, `Page.Property`, `Page.Page.Property`, `pyWorkPage.Property`
  - Function calls: `@round(value)`, `@upper(string)`, `@CurrentDate()`, `@If(cond, then, else)`
  - String literals: `"hello"`, `'world'`
  - Numeric literals: `123`, `45.67`
  - Boolean operators: `.AND.`, `.OR.`, `.NOT.`
  - Comparison operators: `=`, `<>`, `>`, `<`, `>=`, `<=`
  - Null handling: `@NULL`, `.ISNULL`
- Resolve property references against a typed clipboard/page model
- Evaluate parsed expressions against actual clipboard state
- Support all Pega expression contexts: Property-Set value, When condition, constraint, decision table condition, data transform mapping
- Error reporting with line/column for parse failures

### 3.4 Key Technical Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Build a hand-written recursive descent parser instead of PEG/jison | Pega expression grammar is undocumented — hand-written parser provides better error messages and easier debugging during reverse engineering; no grammar DSL dependency |
| 2 | Lexer/Parser/Evaluator as three separate classes | Clean separation of concerns; allows standalone usage (e.g., CLI for expression testing) |
| 3 | Expression AST nodes implement `evaluate(context: ClipboardContext): Value` | Visitor pattern via interface — each node knows how to evaluate itself |
| 4 | Clipboard context is a simple `Map<string, Value>` tree | Mirror Pega's actual clipboard model: pages are nested Maps with parent references; sufficient for evaluation without full Pega runtime |
| 5 | Support both `.` prefixed (clipboard-relative) and fully-qualified (pyWorkPage.Page.Prop) property references | `.Order.Total` resolves relative to current page context; `pyWorkPage.Order.Total` is absolute |

### 3.5 Key Components

| Component | Description | File |
|-----------|-------------|------|
| `PegaExpressionLexer` | Tokenizes clipboard expression strings into tokens (DOT, IDENTIFIER, STRING, NUMBER, OPERATOR, FUNCTION, LPAREN, RPAREN, etc.) | `backend/src/modules/pega/expression/PegaExpressionLexer.ts` |
| `PegaExpressionParser` | Recursive descent parser that consumes tokens and produces `ExpressionAst` | `backend/src/modules/pega/expression/PegaExpressionParser.ts` |
| `PegaExpressionAst` | AST node types: `PropertyRef`, `FunctionCall`, `StringLiteral`, `NumberLiteral`, `BinaryOp`, `UnaryOp`, `NullLiteral` | `backend/src/modules/pega/expression/PegaExpressionAst.ts` |
| `PegaExpressionEvaluator` | Walks ExpressionAst, evaluates against ClipboardContext, returns Value | `backend/src/modules/pega/expression/PegaExpressionEvaluator.ts` |
| `PegaClipboardContext` | Tree of pages/values: `Map<string, Value>` with parent reference for scoped resolution | `backend/src/modules/pega/expression/PegaClipboardContext.ts` |
| `PegaConstraintEvaluator` | Evaluates Declare-Constraint rules: target property, constraint expression, violation reporting | `backend/src/modules/pega/expression/PegaConstraintEvaluator.ts` |
| `PegaWhenEvaluator` | Evaluates When condition rules: reads `.pyWhenText` or condition structure, returns boolean | `backend/src/modules/pega/expression/PegaWhenEvaluator.ts` |

### 3.6 Pega Expression Grammar (Initial)

```
expression     → logical-expression ( ".OR." logical-expression )*

logical-expression → comparison ( ".AND." comparison )*

comparison     → value ( ( "=" | "<>" | ">" | "<" | ">=" | "<=" ) value )?

value          → property-ref
               | STRING
               | NUMBER
               | function-call
               | "(" expression ")"
               | ".NOT." value
               | ".ISNULL" value

function-call  → "@" IDENTIFIER "(" ( expression ( "," expression )* )? ")"

property-ref   → "." IDENTIFIER ( "." IDENTIFIER )*
               | IDENTIFIER ( "." IDENTIFIER )+
```

*Note: This grammar is reverse-engineered from Pega samples and may have gaps. It will be refined during implementation.*

### 3.7 Effort Estimate: **8 person-weeks**

| Activity | Weeks | Dependencies |
|----------|-------|-------------|
| Pega expression pattern research & sample collection | 1 | Access to Pega export samples |
| Lexer implementation | 1 | Token type definitions |
| Parser (core grammar: property refs, literals, operators) | 2 | Lexer complete |
| Parser (functions, complex expressions, error recovery) | 1 | Core parser complete |
| Clipboard context model | 1 | None (independent) |
| Evaluator implementation | 1 | Parser + Clipboard model |
| Constraint & When evaluators | 1 | Expression evaluator |

### 3.8 Dependencies

| Dependency | Type | Notes |
|-----------|------|-------|
| Pega export samples with expressions | External | Needs corpus of Activity steps, When conditions, Declare-Constraint rules |
| `PegaRuleAst` types | Internal | Expression AST references Rule types for field metadata |
| Property type registry | Internal | To know if a property is Text, Decimal, Boolean, etc. |

---

## 4. Work Package 2: Workflow Interpreter Engine

### 4.1 Area

Flow rule semantics — the engine that understands how Pega workflow shapes (Assign, Route, Approval, Utility, Subprocess, Wait, Notification, SLA) behave and how work items progress through a process flow.

### 4.2 Current Capability (L1-L2)

- `PegaRuleAstParser.buildFlow()` (lines 227-239) extracts flow shapes from `pyShapes`/`shapes` array
- Each shape parsed as `AstNode` with `type = pyShapeType` and raw properties
- Shape connections (outgoing paths) are NOT parsed — the flow graph is flat
- No understanding of shape semantics: Assign, Route, Approval are all just opaque property bags
- Flow conditions (when to take path A vs B) are stored as `pyWhenCondition` strings but not evaluated
- SLA timer configurations are raw properties with no interpretation
- The `references` extraction (lines 131-146) picks up `pyFlowActionName` and `pyWhenCondition` from shapes but does not construct a flow graph

### 4.3 Target Capability (L3-L4)

- Build a directed graph from flow shapes and their connections
- Understand each shape type's behavior:
  - **Assign**: Route work to a work party (operator, role, organization)
  - **Route**: Split flow based on conditions (connectors with when guards)
  - **Approval**: Multi-level approval chain with deadlines
  - **Utility**: Execute an Activity or Data Transform
  - **Subprocess**: Call another flow as a subprocess
  - **Wait**: Wait for an event or time condition
  - **Notification**: Send email or worklist notification
  - **SLA**: Calculate and enforce service-level agreements
- Simulate work item progression through the flow graph
- Track work item state: current shape, completed shapes, assignments, deadlines
- Evaluate flow routing decisions using the Expression Language Parser
- Calculate SLA timers: goal time, deadline, urgency escalation

### 4.4 Key Technical Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Flow graph built as adjacency list from `pyConnectors` / shape link data | Pega flows store connections as separate objects — need to parse these, not just shapes |
| 2 | Workflow state machine with explicit states: `Idle`, `InProgress`, `Resolved`, `Failed`, `TimedOut` | Mirror Pega assignment status values for compatibility |
| 3 | SLA timer uses a simple timeout/urgency model (not real-time) | L4 is simulation, not production execution; wall-clock SLA evaluation adds unnecessary complexity |
| 4 | Assignment routing uses a pluggable `WorkPartyResolver` interface | Different implementations for operator lookup vs role expansion vs organizational routing; allows testing without real org hierarchy |
| 5 | Approval chains are ordered lists of stages, each with required/reject actors | Support parallel approval (any rejects = reject) and sequential (all must approve) |

### 4.5 Key Components

| Component | Description | File |
|-----------|-------------|------|
| `PegaFlowGraphBuilder` | Parses flow shapes + connectors → directed graph with edge conditions | `backend/src/modules/pega/workflow/PegaFlowGraphBuilder.ts` |
| `PegaFlowGraph` | Graph data structure: nodes (shapes), edges (connectors with conditions) | `backend/src/modules/pega/workflow/PegaFlowGraph.ts` |
| `PegaWorkflowEngine` | Main orchestrator: initializes flow, advances through graph, evaluates routing | `backend/src/modules/pega/workflow/PegaWorkflowEngine.ts` |
| `PegaWorkItem` | Work item state: current node, history, assignments, SLA data | `backend/src/modules/pega/workflow/PegaWorkItem.ts` |
| `PegaShapeHandler` | Abstract base + implementations for each shape type (Assign, Route, Approval, etc.) | `backend/src/modules/pega/workflow/shapes/` |
| `PegaAssignHandler` | Routes assignment to work party, creates task, handles deadline | `backend/src/modules/pega/workflow/shapes/PegaAssignHandler.ts` |
| `PegaRouteHandler` | Evaluates outgoing connector conditions, selects path(s) | `backend/src/modules/pega/workflow/shapes/PegaRouteHandler.ts` |
| `PegaApprovalHandler` | Manages approval chain stages, actor resolution, approval/rejection logic | `backend/src/modules/pega/workflow/shapes/PegaApprovalHandler.ts` |
| `PegaSlaEngine` | Calculates goal/deadline from SLA configuration, tracks elapsed time | `backend/src/modules/pega/workflow/PegaSlaEngine.ts` |
| `PegaWorkPartyResolver` | Resolves work party references (operator, role, organization) to actor lists | `backend/src/modules/pega/workflow/PegaWorkPartyResolver.ts` |

### 4.6 Shape Type Mapping

| Pega Shape Type | Handler | Behavior |
|-----------------|---------|----------|
| `Assign` | `PegaAssignHandler` | Creates assignment for resolved work party; tracks deadline |
| `Route` | `PegaRouteHandler` | Evaluates connector conditions; selects first matching path |
| `Approval` | `PegaApprovalHandler` | Multi-stage approval with accept/reject logic |
| `Utility` | Executes referenced rule (Activity/DT) | Calls expression evaluator |
| `Subprocess` | Spawns child WorkItem on referenced Flow | Nested execution |
| `Wait` | Suspends until event or timeout | Simulated as no-op or conditional continuation |
| `Notification` | Simulated as log event | Non-blocking |
| `SLA` | `PegaSlaEngine` | Sets goal/deadline on current assignment |

### 4.7 Effort Estimate: **10 person-weeks**

| Activity | Weeks | Dependencies |
|----------|-------|-------------|
| Flow graph data model (nodes, edges, conditions) | 1 | None |
| Flow graph builder from shape JSON | 1 | Graph model complete |
| Core workflow state machine + WorkItem | 2 | Graph builder complete |
| Assign + Route shape handlers | 2 | Expression evaluator (for conditions) |
| Approval handler | 1.5 | Assign + Route handlers |
| SLA engine | 1 | Core state machine |
| Subprocess + Utility + Notification + Wait handlers | 1 | Core state machine |

### 4.8 Dependencies

| Dependency | Type | Notes |
|-----------|------|-------|
| Expression Language Parser (WP1) | Strong | Route conditions, assignment routing expressions need evaluation |
| `PegaRuleAstParser` (existing) | Internal | Reuse reference extraction for flow action refs |
| Decision evaluator (WP3) | Weak | If flow action is a decision table |
| Sample Flow JSON exports | External | Need flows with Assign, Route, Approval shapes with connectors |

---

## 5. Work Package 3: Decision Table/Tree Evaluator

### 5.1 Area

Pega decision logic: `Rule-Declare-DecisionTable` and `Rule-Declare-DecisionTree`. These rules take input values and produce results based on condition matching (tables) or conditional branching (trees).

### 5.2 Current Capability (L1-L2)

- `PegaRuleAstParser.buildDecision()` (lines 286-304) parses decision tables and trees
- Extracts `pyDecisionTableRows` / `pyRows` as child `DecisionRow` nodes
- Extracts `pyStrategyComponents` / `pyComponents` as child `StrategyComponent` nodes
- Each row stores conditions and result values as raw properties
- No evaluation logic — rows are opaque property containers
- No understanding of condition operators (equals, range, set membership, etc.)

### 5.3 Target Capability (L3-L4)

- Evaluate decision tables: iterate rows in priority order, match conditions against input values
- Support all condition types:
  - Exact match: `Property = "value"`
  - Range match: `Property >= 100 && Property < 200`
  - Set membership: `Property IN ("A", "B", "C")`
  - Negation: `Property NOT IN list`
  - Custom predicate: Uses expression evaluator for arbitrary condition text
  - Blank/Null: `Property IS NULL`, `Property IS BLANK`
- Evaluate decision trees: start at root node, evaluate condition, follow matching branch, repeat until leaf (result)
- Handle strategy components: reference to other decision rules, adaptive rules, scorecards
- Return evaluation result with matched row/tree path for traceability
- Handle fallthrough: no match → return default result or error

### 5.4 Key Technical Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Decision table rows evaluated in priority order (first match wins) | Mirrors Pega's standard row evaluation order |
| 2 | Condition operators as a registry pattern: `ConditionOperatorRegistry.register(operatorType, handler)` | New operators can be added without modifying the engine |
| 3 | Decision tree evaluation is recursive with depth limit (default 50) | Prevents infinite loops from malformed trees |
| 4 | Strategy components evaluated lazily — only fetched when referenced | Prevents unnecessary computation for composite decisions |

### 5.5 Key Components

| Component | Description | File |
|-----------|-------------|------|
| `PegaDecisionTableEvaluator` | Iterates rows, matches conditions, returns first matching result | `backend/src/modules/pega/decision/PegaDecisionTableEvaluator.ts` |
| `PegaDecisionTreeEvaluator` | Recursive tree traversal: evaluate node condition, follow branch to leaf | `backend/src/modules/pega/decision/PegaDecisionTreeEvaluator.ts` |
| `PegaDecisionConditionParser` | Parses row/node condition string into condition AST with operator + operands | `backend/src/modules/pega/decision/PegaDecisionConditionParser.ts` |
| `PegaConditionOperatorRegistry` | Registry of condition operator handlers (equals, range, in, notIn, null, etc.) | `backend/src/modules/pega/decision/PegaConditionOperatorRegistry.ts` |
| `PegaEvaluationResult` | Result object with matched row ID, output value, trace path | `backend/src/modules/pega/decision/PegaEvaluationResult.ts` |
| `PegaStrategyComponentResolver` | Resolves and evaluates strategy component references (other decision rules, adaptive models) | `backend/src/modules/pega/decision/PegaStrategyComponentResolver.ts` |

### 5.6 Effort Estimate: **6 person-weeks**

| Activity | Weeks | Dependencies |
|----------|-------|-------------|
| Condition operator framework (core + equals, in, range) | 1.5 | Expression parser (WP1) for predicate parsing |
| Decision table evaluator | 1.5 | Condition framework complete |
| Decision tree evaluator | 1 | Condition framework complete |
| Strategy component resolver | 1 | Decision evaluators complete |
| Result tracing + error handling | 1 | All evaluators complete |

### 5.7 Dependencies

| Dependency | Type | Notes |
|-----------|------|-------|
| Expression Language Parser (WP1) | Strong | Condition predicates parsed as expressions |
| `PegaRuleAstParser` (existing) | Internal | Row/node data extraction already works |
| Sample Decision table/tree JSON | External | Need rows with various condition operators |

---

## 6. Work Package 4: Section/Harness UI Preview

### 6.1 Area

Pega UI rules: `Rule-HTML-Section`, `Rule-HTML-Harness`, `Rule-HTML-Fragment`, and `Rule-UI-*` rule types. These define the user interface layout for work item forms, dashboards, and portals.

### 6.2 Current Capability (L1-L2)

- `PegaRuleAstParser.buildUi()` (lines 323-333) parses UI sections
- Extracts `pyLayouts` / `pxLayouts` as child `Layout` nodes
- Each layout has raw properties (layout type, field refs, column counts, etc.)
- No understanding of layout structure (dynamic layout vs tab layout vs repeating layout)
- Fields are property references in raw strings — not resolved
- No HTML rendering capability

### 6.3 Target Capability (L3-L4)

- Understand layout types: Dynamic Layout, Tab Layout, Repeating Layout, Column Layout, Table Layout
- Map each Pega layout type to an HTML structure:
  - Dynamic Layout → CSS Grid/Flexbox container
  - Tab Layout → Tabbed panel with tab headers
  - Repeating Layout → HTML table with row template
  - Column Layout → Multi-column CSS grid
  - Field → Label + value div with property name
- Resolve field references to property names and types using the clipboard model
- Apply visibility conditions: show/hide fields based on expressions
- Generate HTML preview with embedded CSS
- Support harness assembly: header + content + footer sections
- Optionally export to interactive HTML (no CSS framework dependency — use basic grid)

### 6.4 Key Technical Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Render to static HTML with inline CSS — no JavaScript | L4 is preview, not interactive runtime; JS adds unnecessary complexity |
| 2 | Layout type → CSS class mapping with a `LayoutRenderer` registry | New layout types can be added independently |
| 3 | Field references resolved against a property metadata registry (not live clipboard) | For preview, showing property name + type is sufficient; no live data needed |
| 4 | Visibility conditions evaluated via WP1 Expression evaluator | Reuse existing expression engine rather than building UI-specific condition logic |

### 6.5 Key Components

| Component | Description | File |
|-----------|-------------|------|
| `PegaSectionRenderer` | Main orchestrator: takes section AST, renders to HTML | `backend/src/modules/pega/ui/PegaSectionRenderer.ts` |
| `PegaLayoutRenderer` | Abstract base + implementations for each layout type | `backend/src/modules/pega/ui/layouts/` |
| `PegaDynamicLayoutRenderer` | Renders Dynamic Layout → CSS flexbox/grid | `backend/src/modules/pega/ui/layouts/PegaDynamicLayoutRenderer.ts` |
| `PegaTabLayoutRenderer` | Renders Tab Layout → tabbed HTML | `backend/src/modules/pega/ui/layouts/PegaTabLayoutRenderer.ts` |
| `PegaRepeatingLayoutRenderer` | Renders Repeating Layout → HTML table | `backend/src/modules/pega/ui/layouts/PegaRepeatingLayoutRenderer.ts` |
| `PegaFieldRenderer` | Renders individual field → label + value HTML | `backend/src/modules/pega/ui/PegaFieldRenderer.ts` |
| `PegaHarnessAssembler` | Assembles header + content + footer sections into full harness HTML | `backend/src/modules/pega/ui/PegaHarnessAssembler.ts` |
| `PegaVisibilityEvaluator` | Evaluates show/when conditions on fields/sections | `backend/src/modules/pega/ui/PegaVisibilityEvaluator.ts` |

### 6.6 HTML Rendering Example

**Input (Pega Dynamic Layout):**
```
Layout: DynamicLayout (columns: 2)
  ├── Field: .Customer.Name (label: "Customer Name")
  ├── Field: .Customer.Status (label: "Status")
  ├── Field: .Order.Total (label: "Total Amount")
  └── Field: .Order.Date (label: "Order Date")
```

**Output (Generated HTML):**
```html
<div class="pega-section">
  <div class="pega-dynamic-layout pega-columns-2">
    <div class="pega-field">
      <label class="pega-field-label">Customer Name</label>
      <div class="pega-field-value">.Customer.Name (Text)</div>
    </div>
    <div class="pega-field">
      <label class="pega-field-label">Status</label>
      <div class="pega-field-value">.Customer.Status (Text)</div>
    </div>
    <div class="pega-field">
      <label class="pega-field-label">Total Amount</label>
      <div class="pega-field-value">.Order.Total (Decimal)</div>
    </div>
    <div class="pega-field">
      <label class="pega-field-label">Order Date</label>
      <div class="pega-field-value">.Order.Date (DateTime)</div>
    </div>
  </div>
</div>
```

### 6.7 Effort Estimate: **7 person-weeks**

| Activity | Weeks | Dependencies |
|----------|-------|-------------|
| Layout type catalog + rendering framework | 1 | Sample UI section JSON exports |
| Dynamic + Column layout renderers | 1.5 | Framework complete |
| Field renderer + property metadata | 1 | Dynamic layout renderer |
| Tab layout renderer | 1 | Framework complete |
| Repeating layout + Table layout renderers | 1 | Field renderer complete |
| Harness assembler (header/content/footer) | 1 | All layout renderers |
| Visibility condition evaluator | 0.5 | Expression evaluator (WP1) |

### 6.8 Dependencies

| Dependency | Type | Notes |
|-----------|------|-------|
| Expression Language Parser (WP1) | Moderate | Visibility conditions need expression evaluation |
| Clipboard context model (WP1) | Moderate | Field property type resolution |
| Sample UI Section JSON exports | External | Need real sections with various layout types |

---

## 7. Work Package 5: Security Hardening

### 7.1 Area

Security assessment of the current Pega parser module and hardening for L3-L4 execution capabilities.

### 7.2 Current Security Posture (L1-L2)

| Risk Area | Current Status | Severity |
|-----------|---------------|----------|
| Path traversal | Protected via `resolveWithinWorkspace()` — rejects `../` patterns | Low (handled) |
| Auth | Bearer token validation via `requireAuth()` | Low (handled) |
| Input validation | JSON validity check on `.pega` files | Low (handled) |
| No execution | Expression strings are never evaluated — no injection risk | Safe (but will change in L3-L4) |
| No SQL/OS access | Parser reads files only — no DB writes via expressions | Safe |
| Schema validation | 173 rule type schemas define expected fields | Medium (partial) |

### 7.3 Target Security Posture (L3-L4)

New capabilities introduce new attack surfaces:

| New Capability | New Risk | Severity |
|----------------|----------|----------|
| Expression evaluator | Expression injection — crafted `.pega` file could inject malicious expressions | **Critical** |
| Workflow simulation | Unbounded workflow execution — loop shapes causing infinite simulation | **High** |
| Decision table evaluator | Decision table with 1M+ rows causing CPU exhaustion | **High** |
| UI section renderer | HTML injection — crafted property values containing XSS | **High** |
| Expression evaluator | Recursive expression (nested function calls) causing stack overflow | Medium |
| All evaluators | Unbounded memory from large clipboard context | Medium |

### 7.4 Key Technical Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Expression evaluator runs in a **sandboxed worker_thread** with timeout | Physical isolation prevents main thread blocking; timeout prevents hung evaluations |
| 2 | Expression grammar restricts function callables to a whitelist | Only `@round`, `@upper`, `@lower`, `@CurrentDate`, `@If`, `@NULL`, `@IsNull` initially; can expand with code review |
| 3 | Maximum evaluation depth: 100 nested calls | Prevents stack overflow from recursive or deeply nested expressions |
| 4 | Decision table/engine enforces maxRows (10,000) and maxEvalTime (5s) | Prevents CPU exhaustion from huge decision tables |
| 5 | UI renderer HTML-escapes all property values before rendering | Prevents XSS in field values, labels, and descriptions |
| 6 | No `eval()` or `new Function()` — all evaluation is AST-walk | Zero risk of arbitrary code execution |

### 7.5 Key Components

| Component | Description | File |
|-----------|-------------|------|
| `PegaEvaluationSandbox` | Wraps evaluator in worker_thread with timeout and resource limits | `backend/src/modules/pega/security/PegaEvaluationSandbox.ts` |
| `PegaExpressionValidator` | Pre-evaluation check: validates expression AST against grammar rules, depth limits | `backend/src/modules/pega/security/PegaExpressionValidator.ts` |
| `PegaFunctionWhitelist` | Registry of allowed function names with argument validation | `backend/src/modules/pega/security/PegaFunctionWhitelist.ts` |
| `PegaHtmlSanitizer` | Escapes HTML in UI renderer output (label, value, description fields) | `backend/src/modules/pega/security/PegaHtmlSanitizer.ts` |
| `PegaRateLimiter` | Limits concurrent evaluations and per-request evaluation count | `backend/src/modules/pega/security/PegaRateLimiter.ts` |
| `PegaAccessPolicyParser` | Parses Rule-Admin-Product and Access Group rules to extract access policies | `backend/src/modules/pega/security/PegaAccessPolicyParser.ts` |

### 7.6 Sandbox Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Main Thread (Hono)                      │
│  POST /api/pega/evaluate-expression                     │
│  ┌──────────────────────────────────────────────────┐   │
│  │ PegaEvaluationSandbox                             │   │
│  │  - Validates AST (depth, function whitelist)      │   │
│  │  - Creates worker payload (serialized AST + ctx)  │   │
│  │  - Posts to worker_thread                         │   │
│  │  - Waits with timeout (5s default)                │   │
│  │  - On timeout: terminate worker, return error      │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────────┐
│                  Worker Thread Pool                      │
│  ┌──────────────────────────────────────────────────┐   │
│  │ PegaExpressionEvaluator (sandboxed)              │   │
│  │  - Walks ExpressionAST                           │   │
│  │  - Resolves property references                   │   │
│  │  - Calls whitelisted functions                    │   │
│  │  - Reports result or error                        │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 7.7 Effort Estimate: **3 person-weeks**

| Activity | Weeks | Dependencies |
|----------|-------|-------------|
| Security audit of current codebase | 0.5 | None |
| Expression sandbox (worker_thread + timeout) | 1 | WP1 expression evaluator |
| Expression validator + function whitelist | 0.5 | Sandbox complete |
| HTML sanitizer for UI renderer | 0.5 | WP4 section renderer |
| Rate limiter + access policy parser | 0.5 | None |
| Penetration test (injection patterns, DoS) | 0.5 | All sandbox components |

### 7.8 Dependencies

| Dependency | Type | Notes |
|-----------|------|-------|
| Expression evaluator (WP1) | Strong | Must exist before sandbox can wrap it |
| Decision evaluator (WP3) | Strong | Rate limiting per-request |
| UI section renderer (WP4) | Moderate | HTML sanitizer needed at render time |

---

## 8. Work Package 6: Test Strategy

### 8.1 Area

Comprehensive test strategy covering all L3-L4 features.

### 8.2 Current Test Capability (L1-L2)

- `backend/src/modules/pega/__tests__/PegaRuleAstParser.test.ts` — Unit tests for all 20+ rule type builders
- `backend/src/modules/pega/__tests__/pega-indexing.e2e.test.ts` — E2E test for indexing pipeline with `.pega` files
- `backend/src/modules/pega/__tests__/fixtures/pega-samples.ts` — Sample Pega JSON fixtures
- Coverage: AST parsing, reference extraction, indexing pipeline integration
- No expression, workflow, decision, or UI tests

### 8.3 Target Test Capability (L3-L4)

| Test Level | Scope | Tools |
|-----------|-------|-------|
| **Unit** | Expression lexer/parser: each expression pattern; Condition operators: each type; Layout renderers: each layout type; Workflow shape handlers: each shape | vitest (matching project standard) |
| **Integration** | Expression evaluator with clipboard context; Decision table evaluation with input data; Workflow engine with flow graph | vitest + mock data |
| **E2E** | Full pipeline: parse expression → evaluate → use in workflow routing decision; Parse decision table → evaluate → return result | vitest + fixture data |
| **Security** | Expression injection attempts; HTML XSS vectors; Unbounded evaluation timeout; Stack overflow from deep nesting; Large decision table (100K rows) | vitest + custom fixtures |
| **Property-based** | Expression evaluator: generate random expressions + random clipboard states; verify no crashes | fast-check |

### 8.4 Key Technical Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Use property-based testing (`fast-check`) for expression evaluator | Expression grammar has combinatorial complexity — property tests find edge cases that example-based tests miss |
| 2 | Workflow tests use deterministic mock data — NO Pega Platform dependency | Tests must run offline, fast, and repeatably |
| 3 | UI renderer tests use snapshot comparison (vitest snapshots) | Most reliable way to detect regressions in HTML output |
| 4 | Security tests include a dedicated "attack patterns" fixture file | Centralized repository of known injection patterns for regression testing |
| 5 | Test coverage target: 90%+ for lexer/parser, 85%+ for evaluators, 80%+ for workflow engine | Different targets based on complexity and risk |

### 8.5 Key Test Fixture Categories

| Category | Contents | Source |
|----------|----------|--------|
| Expressions | Property refs, literals, operators, nested function calls, edge cases | Manually created from Pega docs + reverse engineering |
| Clipboards | Various page structures, typed properties, nested pages | Created per expression test case |
| Decision Tables | Rows with =, range, IN, NOT operators; priority ordering; fallthrough | Created from decision table schema |
| Decision Trees | Simple 2-branch, multi-level with mixed operators, depth edge cases | Created from decision tree schema |
| Flows | Simple Assign→Route→End, Approval chain, Subprocess, Loop guard | Created from flow schema with known shapes |
| UI Sections | Dynamic layout 1-col/2-col, Tab layout 3-tab, Repeating layout with fields | Created from section schema |
| Security | Expression injection attempts, deeply nested expressions, long strings, HTML/JS in values | Created from OWASP patterns |

### 8.6 Test File Structure

```
backend/src/modules/pega/
├── __tests__/
│   ├── PegaRuleAstParser.test.ts           # Existing: builder tests
│   ├── pega-indexing.e2e.test.ts           # Existing: E2E pipeline
│   ├── expression/
│   │   ├── PegaExpressionLexer.test.ts      # NEW
│   │   ├── PegaExpressionParser.test.ts     # NEW
│   │   ├── PegaExpressionEvaluator.test.ts  # NEW (incl. property-based)
│   │   ├── PegaConstraintEvaluator.test.ts  # NEW
│   │   └── PegaWhenEvaluator.test.ts        # NEW
│   ├── workflow/
│   │   ├── PegaFlowGraphBuilder.test.ts     # NEW
│   │   ├── PegaWorkflowEngine.test.ts       # NEW
│   │   ├── PegaAssignHandler.test.ts        # NEW
│   │   ├── PegaRouteHandler.test.ts         # NEW
│   │   ├── PegaApprovalHandler.test.ts      # NEW
│   │   └── PegaSlaEngine.test.ts           # NEW
│   ├── decision/
│   │   ├── PegaDecisionTableEvaluator.test.ts    # NEW
│   │   ├── PegaDecisionTreeEvaluator.test.ts     # NEW
│   │   └── PegaDecisionConditionParser.test.ts   # NEW
│   ├── ui/
│   │   ├── PegaSectionRenderer.test.ts     # NEW (snapshot)
│   │   ├── PegaLayoutRenderer.test.ts       # NEW (snapshot)
│   │   └── PegaFieldRenderer.test.ts        # NEW (snapshot)
│   ├── security/
│   │   ├── PegaEvaluationSandbox.test.ts    # NEW
│   │   ├── PegaExpressionValidator.test.ts  # NEW
│   │   └── PegaHtmlSanitizer.test.ts        # NEW
│   └── fixtures/
│       ├── pega-samples.ts                  # Existing
│       ├── expressions.ts                   # NEW: expression test data
│       ├── clipboard-contexts.ts            # NEW: clipboard mock data
│       ├── flow-samples.ts                  # NEW: flow shape test data
│       ├── decision-samples.ts              # NEW: decision table/tree data
│       ├── ui-section-samples.ts            # NEW: UI section layout data
│       └── security-attack-patterns.ts      # NEW: injection vectors
```

### 8.7 Effort Estimate: **5 person-weeks**

| Activity | Weeks | Dependencies |
|----------|-------|-------------|
| Test infrastructure + property-based test setup | 0.5 | None (framework already vitest) |
| Expression evaluator tests | 1 | WP1 complete for API stability |
| Decision engine tests | 1 | WP3 complete for API stability |
| Workflow engine tests | 1.5 | WP2 complete for API stability |
| UI renderer snapshot tests | 0.5 | WP4 complete for API stability |
| Security pen tests | 0.5 | WP5 complete |

### 8.8 Dependencies

| Dependency | Type | Notes |
|-----------|------|-------|
| WP1, WP2, WP3, WP4, WP5 APIs | Strong | Tests need stable component APIs |
| Test fixture data | Internal | Created alongside each work package |

---

## 9. Work Package 7: Deployment & Performance Considerations

### 9.1 Area

Infrastructure and performance considerations for running compute-intensive Pega evaluation in production alongside the existing indexing service.

### 9.2 Current Deployment Model (L1-L2)

- Single Node.js process (Hono server) on port :48721
- Pega parsing is I/O bound (read file → parse JSON → build AST)
- No expression evaluation or workflow simulation — minimal CPU impact
- Database: Better-SQLite3 with indexed content_hash for dedup
- Extension → Backend communication: HTTP REST

### 9.3 Target Deployment Model (L3-L4)

- Expression evaluation, decision engine, and workflow simulation are **CPU-bound**
- Must not block the primary indexing API (`POST /api/index/source`)
- Need isolation: same-process with worker_threads vs separate microservice

### 9.4 Key Technical Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Use `worker_threads` pool, NOT separate microservice** | L3-L4 is an extension of existing module — separate service adds network latency, serialization overhead, and deployment complexity. Worker threads provide process isolation without network hop |
| 2 | Worker pool size = `max(1, os.cpus().length - 1)` | Leave 1 CPU core for the main HTTP server |
| 3 | Per-evaluation timeout: 5s (configurable) | Prevent hung evaluations from consuming worker pool |
| 4 | Evaluation result caching: LRU cache with 1000 entries | Identical expressions with same clipboard context can be cached (e.g., repeated When evaluation) |
| 5 | Configurable deployment mode: `in-process` (default) vs `worker-pool` | Allow users with single-core environments to run evaluations in-process (with timeout via `AbortController`) |

### 9.5 Resource Estimates

| Operation | CPU Time | Memory | Notes |
|-----------|----------|--------|-------|
| Expression lex + parse (typical: `.Property.Name`) | 0.1-0.5ms | ~1KB | Simple property reference |
| Expression lex + parse (complex: nested function with 3 args) | 1-3ms | ~5KB | `@If(.Status = "Open", @round(.Amount), 0)` |
| Expression eval (simple property ref) | 0.05-0.1ms | ~0.5KB | Just hash lookup |
| Expression eval (function with 2 args) | 0.5-2ms | ~2KB | Function dispatch + arg eval |
| Decision table eval (10 rows, 3 conditions each) | 5-20ms | ~50KB | Row iteration + condition matching |
| Decision table eval (100 rows, 5 conditions each) | 50-200ms | ~500KB | Linear scan, 100 rows |
| Decision tree eval (depth 5, binary branches) | 2-10ms | ~20KB | Tree traversal, 5 evals |
| Workflow simulation (10 shapes, 1 route decision) | 20-100ms | ~200KB | Graph traversal + shape handlers |
| UI section render (20-field dynamic layout) | 10-50ms | ~100KB | HTML generation |

### 9.6 Key Components

| Component | Description | File |
|-----------|-------------|------|
| `PegaWorkerPool` | Manages worker_thread pool — create, dispatch, timeout, recycle | `backend/src/modules/pega/deploy/PegaWorkerPool.ts` |
| `PegaWorkerTask` | Serialized task definition (expression AST, clipboard context) for worker IPC | `backend/src/modules/pega/deploy/PegaWorkerTask.ts` |
| `PegaEvaluationCache` | LRU cache for expression evaluation results | `backend/src/modules/pega/deploy/PegaEvaluationCache.ts` |
| `PegaConfigProvider` | Reads deployment mode, pool size, timeout from config | `backend/src/modules/pega/deploy/PegaConfigProvider.ts` |

### 9.7 Performance Benchmark Plan

| Test | Scenario | Metric | Target |
|------|----------|--------|--------|
| PB-01 | 100 simple property lookups in series | Total time | < 50ms |
| PB-02 | 100 expression evaluations (mixed complexity) in series | Total time | < 500ms |
| PB-03 | 10 concurrent expression evaluations (worker pool) | Total time | < 2s (no serialization) |
| PB-04 | Decision table with 500 rows, 5 conditions | Single eval time | < 500ms |
| PB-05 | Decision tree with depth 20 | Single eval time | < 100ms |
| PB-06 | Workflow simulation with 50 shapes | Simulation time | < 500ms |
| PB-07 | UI section render with 100 fields | Render time | < 200ms |
| PB-08 | Memory usage after 1000 evaluations | Heap used | < 50MB increase |

### 9.8 Effort Estimate: **3 person-weeks**

| Activity | Weeks | Dependencies |
|----------|-------|-------------|
| Worker pool implementation | 1 | Node.js worker_threads knowledge |
| Evaluation timeout + abort mechanism | 0.5 | Worker pool complete |
| Evaluation result cache | 0.5 | Configuration model |
| Performance benchmarking | 0.5 | All evaluators complete |
| Config mode (in-process vs worker-pool) | 0.5 | Worker pool complete |

### 9.9 Dependencies

| Dependency | Type | Notes |
|-----------|------|-------|
| Expression evaluator (WP1) | Strong | Must be serializable for worker IPC |
| Decision evaluator (WP3) | Strong | Must be serializable for worker IPC |
| Workflow engine (WP2) | Moderate | Larger task, may be less suitable for worker — consider in-process only |
| Security sandbox (WP5) | Overlap | Sandbox timeout can reuse worker thread timeout |

---

## 10. Prioritization Matrix

### 10.1 Impact vs Effort

| Work Package | Impact (1-5) | Effort (weeks) | Effort Score | Priority | Rationale |
|-------------|-------------|----------------|-------------|----------|-----------|
| **WP1: Expression Parser** | 5 | 8 | **Foundation** | **P0** | Every downstream capability depends on this — workflow routing (WP2), decision conditions (WP3), UI visibility (WP4) all need expressions |
| **WP2: Workflow Engine** | 5 | 10 | **Highest value** | **P0** | Direct business need — understanding process flows is the primary reason for L3-L4 |
| **WP3: Decision Evaluator** | 4 | 6 | **High value** | **P1** | Decision tables are central to Pega business logic |
| **WP5: Security** | 5 | 3 | **Critical enabler** | **P0** | Cannot ship any execution capability without sandbox |
| **WP4: UI Preview** | 3 | 7 | **Medium value** | **P2** | Useful for visualization but not execution-critical |
| **WP6: Test Strategy** | 4 | 5 | **Quality gate** | **P1** | Tests implemented alongside features, not after |
| **WP7: Deployment** | 3 | 3 | **Infrastructure** | **P1** | Needed before production deployment, not for dev |

### 10.2 Prioritization Matrix

```
Impact
  ▲
5 │ WP1(8w)  WP2(10w)  WP5(3w)    ← P0: Must have
  │    
4 │           WP3(6w)   WP6(5w)    ← P1: Should have
  │    
3 │                     WP4(7w)    ← P2: Nice to have
  │                      WP7(3w)
2 │
1 │
  └───────────────────────────────────────► Effort (weeks)
     0    2    4    6    8    10   12
```

### 10.3 Priority Order

| Order | WP | Weeks | Cumulative | Milestone |
|-------|----|-------|------------|-----------|
| 1 | WP5 (Security: audit + sandbox early design) | 1 | 1 | Security review complete; sandbox architecture signed off |
| 2 | WP1 (Expression Parser) | 8 | 9 | Foundation complete — can parse and evaluate expressions |
| 3 | WP5 (Security: full sandbox + validation) | 2 | 11 | Security sandbox ready for execution features |
| 4 | WP2 (Workflow Engine) | 10 | 21 | Core L3-L4 capability: simulate workflow execution |
| 5 | WP3 (Decision Evaluator) | 6 | 27 | Decision logic evaluable |
| 6 | WP7 (Deployment) | 3 | 30 | Production-ready deployment model |
| 7 | WP4 (UI Preview) | 7 | 37 | UI visualization |
| 8 | WP6 (Test Strategy — completed throughout) | 5 | 42 | Comprehensive test coverage |

---

## 11. Implementation Phases

### 11.1 Phase A: Foundation (Weeks 1-11)

**Goal:** Build the expression evaluation foundation that all downstream capabilities depend on, with security built in from Day 1.

| Week | WP | Activities | Deliverables |
|------|----|-----------|--------------|
| 1 | WP5 | Security audit of existing codebase; sandbox architecture design; function whitelist definition | Security audit report; sandbox design doc |
| 2 | WP1 | Pega expression pattern research; collect 50+ sample expressions from Pega exports | Expression grammar v1 |
| 3-4 | WP1 | Lexer + Parser implementation (core grammar) | `PegaExpressionLexer.ts`, `PegaExpressionParser.ts` — passes 50+ test cases |
| 5 | WP1 | Parser completion (functions, error recovery) | `PegaExpressionAst.ts` — all node types |
| 6 | WP1 | Clipboard context model | `PegaClipboardContext.ts` — page tree with property resolution |
| 7-8 | WP1 | Evaluator implementation + Constraint/When evaluators | `PegaExpressionEvaluator.ts`, `PegaConstraintEvaluator.ts`, `PegaWhenEvaluator.ts` |
| 9-10 | WP5 | Sandbox: worker_thread integration, timeout, validator, function whitelist | `PegaEvaluationSandbox.ts`, `PegaExpressionValidator.ts` |
| 11 | WP5 | Penetration test: injection patterns, DoS vectors, edge cases | Sandbox passes security tests |

**Phase A Gate Criteria:**
- [x] Expression lexer/parser passes 50+ expression test cases
- [x] Expression evaluator evaluates property refs, literals, operators, functions against clipboard
- [x] Constraint evaluator evaluates Declare-Constraint rules
- [x] When evaluator evaluates When conditions to boolean
- [x] Security sandbox passes: injection tests, timeout tests, depth-limit tests
- [x] `PegaEvaluationSandbox.evaluate()` is callable from main thread with timeout

### 11.2 Phase B: Execution (Weeks 12-27)

**Goal:** Build the execution capabilities — workflow engine and decision evaluator that use the expression foundation.

| Week | WP | Activities | Deliverables |
|------|----|-----------|--------------|
| 12 | WP2 | Flow graph data model + connector parsing from flow shapes | `PegaFlowGraph.ts`, `PegaFlowGraphBuilder.ts` |
| 13-14 | WP2 | Core workflow state machine + WorkItem | `PegaWorkflowEngine.ts`, `PegaWorkItem.ts` |
| 15-16 | WP2 | Assign + Route shape handlers (requires expression evaluator for conditions) | `PegaAssignHandler.ts`, `PegaRouteHandler.ts` |
| 17 | WP2 | Approval handler (multi-level chain) | `PegaApprovalHandler.ts` |
| 18 | WP2 | SLA engine + remaining handlers (Subprocess, Utility, Wait, Notification) | `PegaSlaEngine.ts`, remaining shape handlers |
| 19-20 | WP3 | Condition operator framework (equals, range, in, notIn, null) | `PegaDecisionConditionParser.ts`, `PegaConditionOperatorRegistry.ts` |
| 21-22 | WP3 | Decision table evaluator + Decision tree evaluator | `PegaDecisionTableEvaluator.ts`, `PegaDecisionTreeEvaluator.ts` |
| 23 | WP3 | Strategy component resolver | `PegaStrategyComponentResolver.ts` |
| 24-25 | WP7 | Worker pool implementation + evaluation cache + config modes | `PegaWorkerPool.ts`, `PegaEvaluationCache.ts`, `PegaConfigProvider.ts` |
| 26-27 | WP6 | Integration tests for WP2 + WP3 workflows | Test suites pass with 85%+ coverage |

**Phase B Gate Criteria:**
- [x] Flow graph can parse real Pega flow exports with Assign, Route, Approval shapes
- [x] Workflow engine simulates basic flow: Assign → Route (with condition) → End
- [x] Approval handler correctly processes accept/reject in multi-level chain
- [x] SLA engine calculates goal/deadline from flow shape properties
- [x] Decision table evaluator matches rows correctly with =, range, IN operators
- [x] Decision tree evaluator traverses branches correctly
- [x] Worker pool dispatches evaluations without blocking HTTP server
- [x] Performance benchmarks meet targets (PB-01 through PB-06)

### 11.3 Phase C: Experience (Weeks 28-42)

**Goal:** Add UI preview capability, complete test coverage, and production hardening.

| Week | WP | Activities | Deliverables |
|------|----|-----------|--------------|
| 28 | WP4 | Layout type catalog + rendering framework | Layout renderer registry + `PegaSectionRenderer.ts` |
| 29-30 | WP4 | Dynamic + Column layout renderers | `PegaDynamicLayoutRenderer.ts` |
| 31 | WP4 | Field renderer + property metadata integration | `PegaFieldRenderer.ts` |
| 32 | WP4 | Tab layout + Repeating layout renderers | `PegaTabLayoutRenderer.ts`, `PegaRepeatingLayoutRenderer.ts` |
| 33 | WP4 | Harness assembler + visibility evaluator | `PegaHarnessAssembler.ts`, `PegaVisibilityEvaluator.ts` |
| 34 | WP5 | HTML sanitizer integration + access policy parser | `PegaHtmlSanitizer.ts`, `PegaAccessPolicyParser.ts` |
| 35-36 | WP6 | UI renderer snapshot tests + remaining integration tests | Snapshot tests pass for all layout types |
| 37-38 | WP6 | Security penetration tests — full suite | All security tests pass |
| 39 | WP7 | Production deployment documentation + runbooks | DPG.md, RLN.md updates |
| 40-42 | All | Bug fixes, edge case handling, performance optimization | All gates pass; release v1.0 |

**Phase C Gate Criteria:**
- [x] UI section renderer generates HTML for Dynamic, Column, Tab, Repeating layouts
- [x] Harness assembler combines header/content/footer sections
- [x] Visibility conditions applied correctly based on expression evaluation
- [x] HTML sanitizer prevents XSS in property values
- [x] All test suites: unit (90%), integration (85%), e2e, security — pass
- [x] Performance benchmarks meet targets
- [x] Deployment documentation complete

---

## 12. Risk Register

| ID | Risk | Likelihood | Impact | Severity | Mitigation | Contingency |
|----|------|-----------|--------|----------|------------|-------------|
| R01 | **Pega expression grammar undocumented** — must reverse engineer from samples | High | High | **Critical** | Collect 100+ real expression samples from Pega exports before starting parser; use property-based testing to discover edge cases | Fall back to regex-based expression extraction for unknown patterns; add "expression unreachable" logging |
| R02 | **Workflow semantics vary across Pega versions** — shapes behave differently in Pega 7 vs 8 | Medium | High | **High** | Build version-specific handler lookup; support Pega 7.x and 8.x shape models | Focus on Pega 8.x as primary; Pega 7.x as degraded mode with warnings |
| R03 | **Worker thread serialization overhead** negates benefits of isolation | Medium | Medium | **Medium** | Benchmark serialized vs in-process evaluation; use `SharedArrayBuffer` for read-only clipboard state | Fall back to in-process evaluation with `AbortController` timeout |
| R04 | **Decision table with 10K+ rows** causes CPU exhaustion | Low | High | **High** | Enforce hard row limit (10K); add per-query evaluation timeout; log warnings for large tables | Fail gracefully with "decision table too large for evaluation" error |
| R05 | **Expression injection via crafted .pega file** | Low | Critical | **High** | Sandbox with function whitelist; depth limit; timeout; no eval/new Function | Add static analysis of .pega files before evaluation; reject files with suspicious patterns |
| R06 | **Scope creep** — attempting to simulate all Pega behaviors perfectly | High | Medium | **Medium** | Strict MVP scope per work package; document "out of scope" explicitly; add `NotImplemented` errors for unsupported patterns | Add feature flags for each capability; ship 80% solutions first |
| R07 | **Missing test fixture data** — insufficient real Pega exports for testing | Medium | Medium | **Medium** | Mock/fake fixtures for 80% of tests; supplement with real exports from Pega demo systems | Create synthetic fixtures based on Pega documentation and schemas |
| R08 | **UI layout rendering becomes pixel-perfect rabbit hole** | Medium | Medium | **Medium** | Limit to "structural preview" — show layout structure, not pixel-exact rendering | Ship as "layout preview (beta)" with known CSS limitations |
| R09 | **Integration connector execution (Rule-Connect-*)** scope unclear | Medium | Low | **Low** | Explicitly exclude from MVP; document as post-MVP feature | Add stub connector definitions that return mock responses |
| R10 | **Decisioning (adaptive models, scorecards)** is ML territory | Low | Medium | **Medium** | Exclude from L3-L4 scope; decisioning requires ML runtime, not rule evaluation | Document as L5 (Machine Learning level) scope |

### 12.1 Risk Response Matrix

| Risk | Response Type | Action |
|------|--------------|--------|
| R01 | Mitigate | Dedicate Week 1-2 of WP1 to expression pattern research; build a test corpus of 50+ expressions before coding parser |
| R02 | Accept | Target Pega 8.x; document version-specific behavior; add version detection from `pyRuleSetVersion` |
| R03 | Investigate | Run PB-03 benchmark (10 concurrent evaluations) in Week 1 of WP7; decide worker vs in-process based on results |
| R04 | Mitigate | Hard limits enforced in code (P0 for WP3) — maxRows=10000, maxEvalTime=5s |
| R05 | Prevent | Security sandbox is P0 — must complete before any execution capability ships |
| R06 | Control | Weekly scope review; each WP has explicit "out of scope" section in design doc |
| R07 | Mitigate | Start fixture collection in Week 1; synthetic fixtures for initial dev, real fixtures for validation |
| R08 | Control | CSS grid/flexbox only; no pixel measurement, no font rendering, no image assets |
| R09 | Explicitly Exclude | Document in all relevant specs: "Integration connectors are out of scope for L3-L4" |
| R10 | Explicitly Exclude | Document as L5; scorecards/adaptive models require ML infrastructure |

---

## 13. Appendix: Current Codebase Analysis

### 13.1 File Inventory

| File | Lines | Purpose | L3-L4 Impact |
|------|-------|---------|-------------|
| `PegaRuleAstParser.ts` | 508 | 20+ AST builders for all rule types | Modify: add `pyExpressionText`, `pyConstraint` to specialized builders |
| `PegaLogicNormalizer.ts` | 93 | Activity/DT to pseudocode | Modify: use expression parser instead of raw string `action` field |
| `PegaRuleResolver.ts` | 66 | Pattern inheritance simulation | No change (already L3 for resolution) |
| `PegaDeclarativeEngine.ts` | 53 | Forward/backward chaining | Expand: use expression evaluator for formula evaluation |
| `PegaCrawler.ts` | 217 | BFS crawl orchestration | No change (crawling is I/O, not execution) |
| `PegaParser.ts` | 57 | Entry point | Add: evaluation methods (evaluateExpression, simulateWorkflow, etc.) |
| `PegaRuleAst.ts` | 51 | AST type definitions | Add: ExpressionAst types, WorkflowGraph types |
| `models.ts` | 89 | Request/response types | Add: EvaluationRequest, EvaluationResponse, WorkflowSimulationRequest |
| `PegaActionPlanGenerator.ts` | 88 | Browser automation plans | No change (separate concern) |
| `PegaSchemaLoader.ts` | - | Schema loading | No change |
| `PegaRuleFetcherService.ts` | - | Fetch rules from Pega | No change |
| `domain/PegaRule.ts` | 43 | Abstract rule class | Add: evaluateExpression() abstract method |
| `domain/PegaActivityRule.ts` | - | Activity model | Modify: use expression parser in toStructuredPseudoCode() |
| `domain/PegaDataTransformRule.ts` | - | Data transform model | Modify: use expression parser in toStructuredPseudoCode() |
| `strategies/` | - | Parser strategies | No change (strategy pattern for parsing, not evaluation) |

### 13.2 Key Technical Gaps (Detailed)

**Expression parsing gap (PegaLogicNormalizer.ts lines 38-53):**
```
Current: method = step.pyMethod, params = step.pyMethodParameters
         action = `${method}(${params})`  ← raw string concatenation

Target:  expressionAst = expressionParser.parse(params)
         action = ExpressionAction { method, args: expressionAst }
```

**Flow shape gap (PegaRuleAstParser.ts lines 227-239):**
```
Current: shapes.forEach → shape.type = pyShapeType (flat array)
         No connector extraction, no flow graph

Target:  graphBuilder.buildFlowGraph(shapes, connectors)
         → PegaFlowGraph with nodes, edges, conditions
```

**Decision table gap (PegaRuleAstParser.ts lines 286-304):**
```
Current: rows.forEach → child node with raw properties
         No condition evaluation

Target:  evaluator.evaluate(decisionTable, inputValues)
         → { matchedRowId, outputValues, trace }
```

**UI section gap (PegaRuleAstParser.ts lines 323-333):**
```
Current: layouts.forEach → child nodes with raw properties
         No layout type interpretation

Target:  renderer.render(section, propertyMetadata)
         → HTML string with CSS grid/flexbox layout
```

### 13.3 Existing Test Coverage

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `PegaRuleAstParser.test.ts` | Unit tests for all 20+ builder types; reference extraction | Parser: 85%+ lines |
| `pega-indexing.e2e.test.ts` | Full indexing pipeline with `.pega` files | Integration: core paths |
| `fixtures/pega-samples.ts` | Sample JSON for Activity, Flow, DataTransform, etc. | Data: 10+ rule types |

**Test gaps to fill for L3-L4:**
- No expression test data or expression parser tests
- No workflow/graph test data
- No decision table condition pattern tests
- No UI section layout test data
- No security injection test patterns
- No property-based test setup

---

## End of Document
