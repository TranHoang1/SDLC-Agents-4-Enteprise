# PegaRuleUnderstandingService — LLM-Ready Rule Context

## Kiến trúc

`PegaRuleUnderstandingService` là Facade pattern kết hợp 7 service:

```
understand(json, { simulate })
  ├── 1. PegaSchemaInferrer.ensureSchema() — đảm bảo schema tồn tại
  ├── 2. PegaFieldDocumentor.generatePromptContext() — field docs
  ├── 3. PegaSemanticAnalyzer.analyze() — summary + intent + side effects
  ├── 4. PegaReferenceExtractor.extractFromRule() — dependencies
  ├── 5. PegaRuleSimulator.simulate() — execution trace
  └── 6. toPromptContext() → LLM-ready formatted string
```

## Output format

```
╔═══════════════════════════════════════════╗
║  Rule Understanding: CalculateOrderTotal   ║
║  Type: Rule-Obj-Activity                  ║
║  Class: Work-Order                        ║
╚═══════════════════════════════════════════╝

── Schema ───────────────────────────────────
  pyActivityName (ref) — Name of the Activity
  pyClassName (ref, required) — Applies to class
  pySteps (array[Embed-Step]) — Step list

── Semantic Analysis ────────────────────────
  Summary: 4 steps: init, check, apply, save
  Intent: Calculate and apply discounts
  Side Effects:
    • calls pyValidateOrder (ActivityCall)
    • updates .pyTotal (DataWrite)

── Dependencies ─────────────────────────────
  → Rule-Obj-Activity: CalculateDiscount (calls)
  → Rule-Obj-When: pyIsDiscountEligible (references)

── Simulation ───────────────────────────────
  Input: { .Total: 1000, .CustomerTier: "Gold" }
  Trace: Step 1 → Step 2 ✓ → Step 3 → .Total = 900
  ✓ 1.2ms
```

## Files

| File | Purpose |
|------|---------|
| `understanding/PegaRuleUnderstandingService.ts` | Orchestrator — 235 dòng |
| `understanding/index.ts` | Re-exports |

## Test coverage

- `__tests__/understanding/PegaRuleUnderstanding.test.ts` — 39 tests
