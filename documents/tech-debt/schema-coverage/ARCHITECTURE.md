# Schema Coverage — 100% Infrastructure

## Vấn đề

Parser có 239 schema tĩnh cho rule types phổ biến. Khi gặp rule type lạ, fallback về
base class generic → thiếu field specificity → LLM phải guess field nào tồn tại → bug.

## Giải pháp: 3-layer schema resolution

### Layer 1 — Static schemas (239 files)
`schemas/rules/*.json` — load vào `PegaMetaModelRegistry` lúc startup.
Base classes (`Rule-XYZ-.json`) là catch-all prefix match.

### Layer 2 — Runtime inference
`PegaSchemaInferrer.ensureSchema(pxObjClass, json, registry)`:
```
1. Check registry → nếu có, return cached
2. Nếu chưa có → inferFromRule():
   - inferBaseClass(): walk up hierarchy (Rule-Obj-Foo → Rule-Obj- → Rule- → @baseclass)
   - inferProperties(): scan JSON fields → infer type từ value pattern
   - inferChildren(): scan array fields
3. registry.registerClass(def)
4. onSchemaInferred callback → PegaSchemaKBService → KB
```

### Layer 3 — KB Persistence
`PegaSchemaKBService.learnSchema()`:
```
1. ensureSchema() → schema in memory
2. saveSchemaToKB() → INSERT INTO knowledge_entries (type='PEGA_SCHEMA', source='pega-schema:{pxObjClass}')
3. Startup: loadSchemasFromKB() → registerClass() cho mọi schema đã học
```

## Flow LLM gặp rule lạ

```
LLM gặp Rule-Obj-XXX (chưa có schema)
→ analyze_artifact(content)
  → PegaRuleAnalyzer
    → ensureSchema() → infer + register + persist KB
    → compileStrategy() → parser cho type mới
    → understand() → schema + semantics + dependencies
→ Lần sau dùng type này: schema có sẵn trong KB + registry
```

## Files

| File | Purpose |
|------|---------|
| `inference/PegaSchemaInferrer.ts` | Core inference engine — 117 dòng |
| `inference/PegaFieldDocumentor.ts` | Field documentation cho LLM — 98 dòng |
| `inference/PegaSchemaKBService.ts` | KB persistence bridge — 156 dòng |
| `inference/PegaSchemaAutoLearner.ts` | Orchestrator — 58 dòng |
| `inference/index.ts` | Re-exports |

## Test coverage

- `__tests__/inference/PegaInference.test.ts` — 55 tests
- `__tests__/inference/PegaSchemaKBService.test.ts` — 24 tests
- Total: 79 tests
