# Technical Design Document (TDD) — SA4E-66: Pega Rule Type Coverage — 7 Parser Modules

**Title**: Expand Parser Coverage from ~15% to ~70% Rule Types (Explicit Parsers) + 100% Effective through DefaultPegaParserStrategy Fallback
**Ticket Key**: SA4E-66
**Author**: SA Agent
**Status**: APPROVED
**Date**: 2026-07-27

---

## 1. Executive Summary & Core Architectural Principle

### 1.1 Core Principle: Strategy Pattern for Parser Resolution
All 6 parser modules implement the `IPegaRuleParserStrategy` interface and are registered in the central `ParserRegistry`. The registry matches incoming `pxObjClass` strings using `supports()`. If no match is found, the `DefaultPegaParserStrategy` catch-all provides a generic result. This ensures that every rule type that enters the system produces a valid parse result.

---

## 2. Diagram Index & Visual Architecture

| Diagram ID | Title | Description | File Path |
| :--- | :--- | :--- | :--- |
| `tdd-class` | Parser Class Hierarchy | Full class diagram for IPegaRuleParserStrategy implementations | [tdd_class_diagram.png](./diagrams/tdd_class_diagram.png) |
| `tdd-registry` | Parser Registry Flow | Registry resolution and strategy selection | [tdd_registry_flow.png](./diagrams/tdd_registry_flow.png) |
| `tdd-ast` | AST Type Hierarchy | Typed AST interfaces across all 6 modules | [tdd_ast_hierarchy.png](./diagrams/tdd_ast_hierarchy.png) |

### 2.1 Class Hierarchy
![Parser Class Hierarchy](./diagrams/tdd_class_diagram.png)

### 2.2 Registry Flow
![Parser Registry Flow](./diagrams/tdd_registry_flow.png)

### 2.3 AST Type Hierarchy
![AST Type Hierarchy](./diagrams/tdd_ast_hierarchy.png)

---

## 3. Class Hierarchy

### Interface: `IPegaRuleParserStrategy`
```
backend/src/modules/pega/strategies/IPegaRuleParserStrategy.ts
```

```typescript
interface IPegaRuleParserStrategy {
  supports(pxObjClass: string): boolean;
  parse(json: Record<string, unknown>): ParseResult;
}
```

Where `ParseResult` contains `{ symbol: ExtractedPegaSymbol; dependencies: UnresolvedDependency[] }`.

### Registry: `PegaParserRegistry`
```
backend/src/modules/pega/strategies/PegaParserRegistry.ts
```
- `registerStrategy(strategy: IPegaRuleParserStrategy): void`
- `parse(json: Record<string, unknown>): ParseResult`
- Iterates strategies in registration order; returns first match
- Fallback strategy: `DefaultPegaParserStrategy` (match-all)

### Concrete Parsers (all implement `IPegaRuleParserStrategy`):

| Class | File Pattern | Module Path |
|-------|-------------|-------------|
| `PegaConnectParser` | `Rule-Connect-.*` / `Rule-Service-.*` | `backend/src/modules/pega/connect/PegaConnectParser.ts` |
| `PegaDeclareParser` | `Rule-Declare-.*` | `backend/src/modules/pega/declare/PegaDeclareParser.ts` |
| `PegaAccessParser` | `Rule-Access-.*` / `Rule-Admin-.*` / `Data-Admin-.*` | `backend/src/modules/pega/access/PegaAccessParser.ts` |
| `PegaPortalParser` | `Rule-HTML-.*` / `Rule-Portal` / `Rule-Navigation` | `backend/src/modules/pega/portal/PegaPortalParser.ts` |
| `PegaDecisioningParser` | `Rule-Decision-.*` / `Rule-Strategy-.*` | `backend/src/modules/pega/decisioning/PegaDecisioningParser.ts` |
| `PegaMiscParser` | Catch-all for 15+ specific patterns | `backend/src/modules/pega/misc/PegaMiscParser.ts` |
| `DefaultPegaParserStrategy` | fallback (match-all) | `backend/src/modules/pega/strategies/DefaultPegaParserStrategy.ts` |

---

## 4. Domain Type Interfaces (flat — no unified base AST)

Each module defines flat TypeScript interfaces in its own `*Types.ts` file:

| Module | Types File | Key Interface |
|--------|-----------|---------------|
| Connect | `PegaConnectTypes.ts` | `PegaConnectRule`, `PegaConnectHeader`, `PegaServiceRule` |
| Declare | `PegaDeclareTypes.ts` | `PegaDeclareRule` |
| Access | `PegaAccessTypes.ts` | `PegaAccessRule` |
| Portal | `PegaPortalTypes.ts` | `PegaPortalRule` |
| Decisioning | `PegaDecisioningTypes.ts` | `PegaDecisioningRule` |
| Misc | `PegaMiscTypes.ts` | `MapValue`, `FieldValue`, `CaseType`, `Stage`, `ServiceLevel`, `Circumstance`, `Agent`, `QueueProcessor`, `ReportDef`, `Correspondence`, `FileBinary`, `FileText`, `EditValidate`, `AutoTest`, `Utility`, `Message`, `Stream`, `Shortcut` |

All interfaces are independent (no common base type). The parser's `parse()` returns `ParseResult` containing an `ExtractedPegaSymbol` and dependencies.

---

## 5. Data Flow

```
Raw Rule JSON (from Pega Bridge)
  │
  ▼
PegaParserRegistry.parse(json)
  │
  ├── Match found → Explicit parser (e.g., PegaConnectParser)
  │     │
  │     ▼
  │   ExplicitParser.parse(json)
  │     │
  │     ▼
  │   ParseResult { symbol, dependencies }
  │
  └── No match → DefaultPegaParserStrategy
        │
        ▼
      DefaultPegaParserStrategy.parse(json)
        │
        ▼
      ParseResult { symbol, dependencies }
```

---

## 6. Parser Registry Configuration

```typescript
const registry = new PegaParserRegistry();

// Register explicit parsers (high priority first)
registry.registerStrategy(new PegaConnectParser());
registry.registerStrategy(new PegaDeclareParser());
registry.registerStrategy(new PegaAccessParser());
registry.registerStrategy(new PegaPortalParser());
registry.registerStrategy(new PegaDecisioningParser());
registry.registerStrategy(new PegaMiscParser());

// DefaultPegaParserStrategy is built-in as fallback (match-all)

// Usage
const result = registry.parse(rawRuleJson);
```
