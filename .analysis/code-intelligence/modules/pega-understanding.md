# PegaRuleUnderstandingService

**Location**: `backend/src/modules/pega/understanding/`

## Overview
A unified orchestrator that combines ALL existing Pega analysis components into a single "understand this rule" result for LLM consumption.

## Key Files

| File | Purpose |
|------|---------|
| `PegaRuleUnderstandingService.ts` | Main orchestrator combining schema inference, field documentation, semantic analysis, reference extraction, and simulation |
| `index.ts` | Re-exports `PegaRuleUnderstandingService` class and `PegaRuleUnderstanding` interface |

## Interface: `PegaRuleUnderstanding`

| Field | Type | Description |
|-------|------|-------------|
| `pxObjClass` | `string` | Rule object class (e.g., "Rule-Obj-Activity") |
| `name` | `string` | Extracted rule name |
| `className` | `string` | Applies-to class name |
| `fqn` | `string` | Fully qualified name: `{pxObjClass}:{className}:{name}` |
| `schema` | `{ classDefinition, fieldDocs, inferred }` | Schema info from Inferrer + FieldDocumentor |
| `semantics` | `{ summary, intent, sideEffects, dataFlow, conditions }` | Semantic analysis from SemanticAnalyzer |
| `dependencies` | `ResolvedDependency[]` | Dependencies from ReferenceExtractor |
| `dependencyGraph` | `string` | Text representation of dependency graph |
| `simulation` | `{ input, result, trace } \| null` | Simulation from RuleSimulator (null when not requested) |
| `promptContext` | `string` | Combined, formatted string ready for LLM |

## Dependencies

- `PegaSchemaInferrer` — schema inference and `ensureSchema`
- `PegaFieldDocumentor` — field documentation generation (`generatePromptContext`)
- `PegaSemanticAnalyzer` — semantic analysis (`analyze`)
- `PegaRuleSimulator` — rule simulation (`simulate`)
- `PegaReferenceExtractor` — dependency extraction (`extractFromRule`)
- `PegaMetaModelRegistry` — known class registry
- `PegaMetaModelCompiler` — strategy compilation

## Key Methods

### `understand(json, options?)`
Async method that orchestrates ALL analysis pipelines:
1. Extracts identity (pxObjClass, className, name, fqn)
2. `inferrer.ensureSchema()` — ensures schema exists (infers if unknown)
3. `documentor.generatePromptContext()` — generates field documentation
4. `analyzer.analyze()` — produces semantic analysis
5. `extractor.extractFromRule()` — extracts dependencies
6. If `options.simulate` — `simulator.simulate()` with optional input clipboard
7. Builds `PegaRuleUnderstanding` with `promptContext`

### `toPromptContext(understanding)`
Produces a beautifully formatted string with box-drawing characters:
- Header block with rule identity
- Schema section with field documentation
- Semantic Analysis section (summary, intent, side effects, data flow, conditions)
- Dependencies section
- Simulation section (when present)

## Pattern Used
Facade pattern — wraps 7+ analysis services behind a single `understand()` method.
