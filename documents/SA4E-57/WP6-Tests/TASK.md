# TASK — Work Package 6: Test Strategy

## 1. Summary

Comprehensive test strategy covering all L3-L4 features across expression, workflow, decision, UI, and security components. Uses vitest (existing project standard), property-based testing with `fast-check`, and snapshot comparison for UI renderers. Tests written alongside feature implementation (not after), with coverage gates for each WP.

Reference: [Upgrade Plan §8](../SA4E-56/pega-parser-upgrade-plan.md#8-work-package-6-test-strategy)

## 2. Test Levels

| Level | Scope | Tool |
|-------|-------|------|
| **Unit** | Expression lexer/parser: each expression pattern; Condition operators: each type; Layout renderers: each layout type; Workflow shape handlers: each shape | vitest |
| **Integration** | Expression evaluator with clipboard context; Decision table with input data; Workflow engine with flow graph | vitest + mock data |
| **E2E** | Full pipeline: parse → evaluate → workflow routing decision; Parse decision table → evaluate → return result | vitest + fixture data |
| **Security** | Expression injection attempts; HTML XSS vectors; Unbounded evaluation timeout; Stack overflow; Large decision table (100K rows) | vitest + custom fixtures |
| **Property-based** | Expression evaluator: generate random expressions + random clipboard states, verify no crashes | `fast-check` |

## 3. Test File Inventory (70+ test files)

### 3.1 Expression Tests
- `PegaExpressionLexer.test.ts` — 10+ expression tokenization cases
- `PegaExpressionParser.test.ts` — 15+ expression parsing cases + error cases
- `PegaExpressionEvaluator.test.ts` — 10+ evaluation cases + property-based tests
- `PegaConstraintEvaluator.test.ts` — 5+ constraint evaluation cases
- `PegaWhenEvaluator.test.ts` — 5+ When condition evaluation cases

### 3.2 Workflow Tests
- `PegaFlowGraphBuilder.test.ts` — 5+ flow graph construction cases
- `PegaWorkflowEngine.test.ts` — 5+ full flow simulation cases
- `PegaAssignHandler.test.ts` — 3+ assignment routing cases
- `PegaRouteHandler.test.ts` — 3+ connector condition routing cases
- `PegaApprovalHandler.test.ts` — 3+ approval chain cases
- `PegaSlaEngine.test.ts` — 3+ SLA timer calculation cases

### 3.3 Decision Tests
- `PegaDecisionTableEvaluator.test.ts` — 5+ table evaluation cases
- `PegaDecisionTreeEvaluator.test.ts` — 5+ tree traversal cases
- `PegaDecisionConditionParser.test.ts` — 5+ condition parsing cases

### 3.4 UI Tests
- `PegaSectionRenderer.test.ts` — 5+ snapshot cases
- `PegaLayoutRenderer.test.ts` — 5+ snapshot cases (one per layout type)
- `PegaFieldRenderer.test.ts` — 3+ field rendering cases

### 3.5 Security Tests
- `PegaEvaluationSandbox.test.ts` — 5+ sandbox timeout/injection cases
- `PegaExpressionValidator.test.ts` — 5+ validation rule cases
- `PegaHtmlSanitizer.test.ts` — 5+ XSS sanitization cases

### 3.6 Fixture Files
- `fixtures/expressions.ts` — 50+ expression test strings
- `fixtures/clipboard-contexts.ts` — 20+ clipboard mock states
- `fixtures/flow-samples.ts` — 10+ flow shape JSON fixtures
- `fixtures/decision-samples.ts` — 10+ decision table/tree fixtures
- `fixtures/ui-section-samples.ts` — 10+ UI section layout fixtures
- `fixtures/security-attack-patterns.ts` — 20+ injection/XSS/DoS vectors

## 4. Coverage Targets

| Module | Target | Method |
|--------|--------|--------|
| Expression lexer | 90% lines | vitest --coverage |
| Expression parser | 90% lines | vitest --coverage |
| Expression evaluators | 85% lines | vitest --coverage |
| Decision evaluators | 85% lines | vitest --coverage |
| Workflow engine | 80% lines | vitest --coverage |
| Shape handlers | 80% lines | vitest --coverage |
| UI renderers | 85% lines | vitest --coverage |
| Security components | 90% lines | vitest --coverage |

## 5. Effort: 5 person-weeks

| Activity | Weeks | Dependencies |
|----------|-------|-------------|
| Test infrastructure + property-based test setup | 0.5 | None (vitest already configured) |
| Expression evaluator tests | 1 | WP1 API stable |
| Decision engine tests | 1 | WP3 API stable |
| Workflow engine tests | 1.5 | WP2 API stable |
| UI renderer snapshot tests | 0.5 | WP4 API stable |
| Security pen tests | 0.5 | WP5 complete |

## 6. Dependencies

| Dependency | Type | Notes |
|-----------|------|-------|
| WP1, WP2, WP3, WP4, WP5 APIs | Strong | Tests need stable component interfaces |
| Test fixture data | Internal | Created alongside each work package |
| `fast-check` library | Tooling | Add to devDependencies |