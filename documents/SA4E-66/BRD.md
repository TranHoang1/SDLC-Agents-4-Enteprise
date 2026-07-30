# Business Requirements Document (BRD) — SA4E-66: Pega Rule Type Coverage — 7 Parser Modules

**Title**: Expand Parser Coverage from ~15% to ~70% Rule Types (Explicit Parsers) + 100% Effective through Default Fallback
**Ticket Key**: SA4E-66
**Author**: SM Agent (Coordinated with BA, TA, SA, DEV, QA, Security, DevOps)
**Status**: APPROVED
**Date**: 2026-07-27

---

## 1. Executive Summary & Core Architectural Principle

### 1.1 Core Principle: Strategy-Based Parser Expansion with Default Fallback Guard
The SDLC-Agents-4-Enterprise platform currently covers ~15% of Pega rule types through explicit parsers. SA4E-66 expands coverage to ~70% through 7 new strategy-based parser modules, each implementing the `IPegaRuleParserStrategy` interface. Any rule type without an explicit parser is automatically handled by the DefaultPegaParserStrategy fallback, providing 100% effective coverage.

- **Explicit Parsers**: 6 modules (Connect, Declare, Access, Portal, Decisioning, Misc) covering 40+ Pega rule types with 172 total tests.
- **DefaultPegaParserStrategy Fallback**: Generic JSON-to-symbol transformer for any unrecognized rule type, ensuring zero gaps in coverage.
- **Parser Registry**: Central registry (`PegaParserRegistry.ts`) maps `pxObjClass` patterns to parser strategies at runtime.

---

## 2. Diagram Index & Visual Architecture

| Diagram ID | Title | Description | File Path |
| :--- | :--- | :--- | :--- |
| `brd-arch` | Parser Module Architecture | 6 parser modules + DefaultPegaParserStrategy fallback architecture | [brd_architecture.png](./diagrams/brd_architecture.png) |
| `brd-flow` | Rule Type Resolution Flow | Runtime flow from raw rule JSON to typed AST | [brd_flow.png](./diagrams/brd_flow.png) |
| `brd-coverage` | Coverage Map | Explicit vs DefaultPegaParserStrategy fallback coverage per rule category | [brd_coverage.png](./diagrams/brd_coverage.png) |

### 2.1 Parser Module Architecture
![Parser Module Architecture](./diagrams/brd_architecture.png)

### 2.2 Rule Type Resolution Flow
![Rule Type Resolution Flow](./diagrams/brd_flow.png)

### 2.3 Coverage Map
![Coverage Map](./diagrams/brd_coverage.png)

---

## 3. Business Objectives & Requirements

### BR-01: Parse Integration Rules (Connect REST/SOAP/SQL/File/Service)
- **Requirement**: Implement Connect parser module for `Rule-Connect-*` and `Rule-Service-*` rules covering REST, SOAP, SQL, File, HTTP, MQ, JMS, JCA, Java, EJB, dotNet, and CMIS strategies.
- **Target Module**: `backend/src/modules/pega/connect/`
- **Tests**: 20

### BR-02: Parse Declarative Rules (Expression/OnChange/Trigger/Pages/Decision)
- **Requirement**: Implement Declare parser module for all `Rule-Declare-*` types: Expression, OnChange, Trigger, Pages, Constraints, Index, DecisionTable, DecisionTree. Integrate with PegaExpressionParser for AST construction.
- **Target Module**: `backend/src/modules/pega/declare/`
- **Tests**: 30

### BR-03: Parse Security/Admin Rules (AccessGroup/Role/Privilege/OperatorID)
- **Requirement**: Implement Access parser module for `Rule-Access-*`, `Rule-Admin-*`, and `Data-Admin-*` rules covering AccessGroup, AccessRole, Privilege, OperatorID, OrgDivision, OrgUnit, and SecurityVA.
- **Target Module**: `backend/src/modules/pega/access/`
- **Tests**: 33

### BR-04: Parse UI/Portal Rules (Section/Harness/FlowAction/Portal/Skin)
- **Requirement**: Implement Portal parser module for `Rule-HTML-*`, `Rule-Portal`, and `Rule-Navigation` rules covering Section, Harness, FlowAction, Portal, Skin, and Navigation. Bridge to UI renderer types.
- **Target Module**: `backend/src/modules/pega/portal/`
- **Tests**: 23

### BR-05: Parse Decisioning/Strategy Rules (Strategy/NBA/Offer)
- **Requirement**: Implement Decisioning parser module for `Rule-Decision-*` and `Rule-Strategy-*` rules covering Strategy, NBA, Offer, Proposition, and Treatment.
- **Target Module**: `backend/src/modules/pega/decisioning/`
- **Tests**: 37

### BR-06: Parse Misc Rules (CaseType/Stage/Report/Utility/Stream)
- **Requirement**: Implement Misc parser module for 15+ catch-all rule types: MapValue, FieldValue, CaseType, Stage, ServiceLevel, Circumstance, Agent, ReportDef, Correspondence, File, EditValidate, AutoTest, Utility, Message, Stream, Shortcut.
- **Target Module**: `backend/src/modules/pega/misc/`
- **Tests**: 29

### BR-07: Fallback to DefaultPegaParserStrategy for Unrecognized Rule Types
- **Requirement**: Any `pxObjClass` without a registered explicit parser must be handled by the DefaultPegaParserStrategy fallback, producing a valid parse result. This ensures 100% effective coverage across all Pega rule types.
- **Implementation**: `DefaultPegaParserStrategy.ts` in the strategies directory as a match-all fallback.

---

## 4. Functional Specifications — 7 Parser Modules

### Module 1: Connect Parser (backend/src/modules/pega/connect/)
- **Description**: Strategy parser for `Rule-Connect-*` and `Rule-Service-*` rules.
- **Strategy Types**: REST, SOAP, SQL, File, HTTP, MQ, JMS, JCA, Java, EJB, dotNet, CMIS.
- **Capabilities**: Parses auth profiles (basic, oauth, cert), request/response data transforms (JSON, XML, CSV), connection parameters, endpoint URLs.
- **Target Agent**: DEV Agent, SA Agent.

### Module 2: Declare Parser (backend/src/modules/pega/declare/)
- **Description**: Strategy parser for all `Rule-Declare-*` rule types.
- **Sub-types**: DeclareExpression, DeclareOnChange, DeclareTrigger, DeclarePages, DeclareConstraints, DeclareIndex, DecisionTable, DecisionTree.
- **Capabilities**: Builds AST for declarative expressions, event-driven triggers, page references, constraint validation rules, and decision logic.
- **Target Agent**: DEV Agent, SA Agent.

### Module 3: Access Parser (backend/src/modules/pega/access/)
- **Description**: Strategy parser for `Rule-Access-*`, `Rule-Admin-*`, `Data-Admin-*`.
- **Sub-types**: AccessGroup, AccessRole, Privilege, OperatorID, OrgDivision, OrgUnit, SecurityVA.
- **Capabilities**: Parses access control policies, role hierarchies, privilege definitions, operator profiles, organizational structures.
- **Target Agent**: Security Agent, SA Agent.

### Module 4: Portal Parser (backend/src/modules/pega/portal/)
- **Description**: Strategy parser for `Rule-HTML-*`, `Rule-Portal`, `Rule-Navigation`.
- **Sub-types**: Section, Harness, FlowAction, Portal, Skin, Navigation.
- **Capabilities**: Parses UI layout definitions, harness structures, flow action configurations, portal compositions, skin properties.
- **Target Agent**: DEV Agent, UI Agent.

### Module 5: Decisioning Parser (backend/src/modules/pega/decisioning/)
- **Description**: Strategy parser for `Rule-Decision-*` and `Rule-Strategy-*`.
- **Sub-types**: Strategy, NBA, Offer, Proposition, Treatment.
- **Capabilities**: Parses strategy trees, next-best-action configurations, offer definitions, proposition filters, treatment rules.
- **Target Agent**: BA Agent, DEV Agent.

### Module 6: Misc Parser (backend/src/modules/pega/misc/)
- **Description**: Catch-all strategy parser for 15+ rule types not covered by other modules.
- **Sub-types**: MapValue, FieldValue, CaseType, Stage, ServiceLevel, Circumstance, Agent, ReportDef, Correspondence, File, EditValidate, AutoTest, Utility, Message, Stream, Shortcut.
- **Capabilities**: Generic parsing with type-specific property extraction.
- **Target Agent**: All Agents.



---

## 5. Verification & Quality Gates

| Phase | Quality Gate | Criteria |
| :--- | :--- | :--- |
| Phase 1: BA | Requirement Coverage | 100% coverage of BR-01 through BR-07 across all 7 parser modules. |
| Phase 2: TA | Architecture Alignment | All parsers implement `IPegaRuleParserStrategy`. Registry resolves by `pxObjClass`. |
| Phase 3: SA | Technical Design | TDD specifies class hierarchy, data flow, and ParserRegistry resolution. |
| Phase 4: QA | Test Plan | STP covers 172 tests across all 6 modules with unit + integration levels. |
| Phase 5: DEV | Implementation | Code complies with SOLID, 200 lines/file limit, and 0 lint errors. |
| Phase 6: QA | Execution | 100% pass rate on all 172 automated tests. |
| Phase 7: DevOps | Release Package | Complete documentation and build artifacts. |
