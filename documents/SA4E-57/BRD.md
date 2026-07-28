# Business Requirements Document (BRD) — SA4E-57

**Title**: Build 6 Pega REST Bridge Services & Local KB AST Semantic Engine for SDLC Multi-Agent Pipeline  
**Ticket Key**: SA4E-57  
**Author**: SM Agent (Coordinated with BA, TA, SA, DEV, QA, Security, DevOps)  
**Status**: APPROVED  
**Date**: 2026-07-27  

---

## 1. Executive Summary & Core Architectural Principle

### 1.1 Core Principle: Local Semantic Understanding in KB (Zero Blind Delegation)
**CRITICAL DESIGN DIRECTIVE**: The SDLC-Agents-4-Enterprise platform **MUST NOT** rely on Pega as a black box execution engine for understanding rules. 

- **Pega Platform** serves as the remote target system.
- **Node.js Backend Engine** (`PegaRuleFetcherService.ts`, `PegaRuleAstParser.ts`, `PegaLogicNormalizer.ts`, `PegaService.ts`) is the **Local Intelligence Core**.
- All Pega rules fetched from Pega Server via the 6 REST Bridge Services (`KiroAgents`) are **parsed locally into typed ASTs**, stored in PostgreSQL (`knowledge_entries` & `graph_nodes`), and analyzed by our local Expression, Flow, and Decision evaluators.
- This empowers AI Agents (BA, SA, DEV, QA, DevOps) to perform **offline reasoning, dependency analysis, AST graph searches, and automated code generation** without being dependent on remote Pega runtime calls.

---

## 2. Diagram Index & Visual Architecture

| Diagram ID | Title | Description | File Path |
| :--- | :--- | :--- | :--- |
| `brd-process` | High-Level Process Map | Local AST Parsing & KB Semantic Enhancement Pipeline | [brd_process_map.png](./diagrams/brd_process_map.png) |
| `brd-arch` | Pega REST Bridge Architecture | Full System Architecture showing VS Code Extension, Hono Backend KB, PostgreSQL DB, and Pega Platform. | [brd_architecture.png](./diagrams/brd_architecture.png) |
| `brd-usecases` | 6 Pega Bridge REST Services Use Cases | Detailed Use Case Diagram for all 6 REST Services mapped to SDLC Agents (BA, SA, DEV, QA, DevOps). | [brd_usecases.png](./diagrams/brd_usecases.png) |
| `brd-seq` | End-to-End SDLC Agent Sequence Flow | Sequence diagram showing flow from Ticket Indexing ➔ Local AST Parsing ➔ KB Storage ➔ AI Code Gen ➔ Pega Rule Sync. | [brd_sequence.png](./diagrams/brd_sequence.png) |

### 2.1 High-Level Process Map
![BRD High-Level Process Map](./diagrams/brd_process_map.png)

### 2.2 System Architecture Diagram
![Pega REST Bridge Architecture](./diagrams/brd_architecture.png)

### 2.3 Use Case Diagram — 6 Pega Bridge REST Services & Local KB Engine
![6 Pega Bridge REST Services Use Cases](./diagrams/brd_usecases.png)

### 2.4 End-to-End Sequence Diagram
![End-to-End SDLC Agent Sequence Flow](./diagrams/brd_sequence.png)

---

## 3. Business Objectives & Requirements

### BR-01: Full Pega Rule Instance Ingestion & AST Parsing (Read & Knowledge Axis)
- **Requirement**: Ingest 100% full content (XML/JSON payload 27KB+) of any Pega Rule (`Rule-Obj-Class`, `Rule-HTML-Section`, `Rule-Obj-FlowAction`, `Rule-Obj-Flow`, `Rule-Declare-Pages`), parse into typed AST, and store into local Knowledge Base (`knowledge_entries` and `graph_nodes`).
- **Target Services**:
  - `GET /api/v1/rules/{insKey}` — Query by `pzInsKey`.
  - `POST /api/v1/rules/query` — Query by **Rule Name** (`pyRuleName`), **Rule Type Class** (`pxObjClass`), and **Applies To Class** (`pyClassName`/`appliesTo`).

### BR-02: Rule Discovery & Graph Indexing (Discovery Axis)
- **Requirement**: Automatically scan and list all rules inside an Application / RuleSet, building directed graph edges (`graph_edges`) for property dependencies and rule references.
- **Target Service**: `GET /api/v1/rules/list`.

### BR-03: Local Expression & Decision Logic Interpreter (Local Intelligence Axis)
- **Requirement**: Provide local Node.js AST interpreters for Pega expressions, workflow graph traversal, and decision tables/trees so that AI Agents can evaluate logic offline without remote Pega execution.

### BR-04: Bidirectional Code Generation & Update (Write Axis)
- **Requirement**: Enable DEV Agent to automatically save, update, or create Pega Rules back into Pega Server after local AST verification.
- **Target Service**: `POST /api/v1/rules/save`.

### BR-05: Version Control & Rule Lock Management (Governance Axis)
- **Requirement**: Ensure safe concurrent edits by checking out rules before editing and checking in upon completion.
- **Target Service**: `POST /api/v1/rules/checkout`.

### BR-06: Automated Quality Gate Verification (Test Axis)
- **Requirement**: Enable QA Agent to execute Pega Unit Tests / Case Scenarios automatically on Pega Server.
- **Target Service**: `POST /api/v1/rules/test`.

---

## 4. Functional Specifications — The 6 Pega REST Bridge Services & KB Engine

### UC-01: Fetch Rule Instance by Handle (`GET /api/v1/rules/{insKey}`)
- **Description**: Fetches 100% complete rule definition XML/JSON from Pega DB using its exact `pzInsKey`. Parses rule locally into AST and stores in KB.
- **Target Agent**: BA Agent, SA Agent, Indexer.

### UC-02: Query Rule by Identifiers (`POST /api/v1/rules/query`)
- **Description**: Queries a Pega rule using its 3 core identifiers (`pxObjClass`, `appliesTo`, `pyRuleName`), materializes local `.pega.json` file in workspace.
- **Target Agent**: BA Agent, SA Agent, DEV Agent.

### UC-03: List Application Rules (`GET /api/v1/rules/list`)
- **Description**: Lists all rules within an Application / RuleSet scope, enabling full workspace crawling.
- **Target Agent**: BA Agent, Indexer.

### UC-04: Create / Update Pega Rule (`POST /api/v1/rules/save`)
- **Description**: Saves or updates a Pega Rule generated by AI DEV Agent directly back into Pega Server after local AST validation.
- **Target Agent**: DEV Agent.

### UC-05: Checkout / Checkin Lock Control (`POST /api/v1/rules/checkout`)
- **Description**: Manages rule locks by checking out a rule into the developer's private ruleset before editing and checking in upon completion.
- **Target Agent**: DEV Agent, DevOps Agent.

### UC-06: Execute Scenario Unit Test (`POST /api/v1/rules/test`)
- **Description**: Executes Pega Scenario Tests / Unit Test Suites to verify rule logic on remote server.
- **Target Agent**: QA Agent.

---

## 5. Verification & Quality Gates

| Phase | Quality Gate | Criteria |
| :--- | :--- | :--- |
| Phase 1: BA | Requirement Coverage | 100% coverage of Read, Discovery, Local KB Intelligence, Write, Governance, and Test axes. |
| Phase 2: TA | Architecture Alignment | 6 REST Services mapped cleanly to Pega Service Package `KiroAgents` + local Backend AST Engine. |
| Phase 3: SA | Technical Design | TDD specifies all endpoints, DTOs, database tables, and local AST schemas. |
| Phase 4: QA | Test Plan | STP covers unit, integration, KB graph indexing, and scenario testing. |
| Phase 5: DEV | Implementation | Code complies with SOLID, 200 lines/file limit, and 0 lint errors. |
| Phase 6: QA | Execution | 100% pass rate on all automated test suites. |
| Phase 7: DevOps | Release Package | VSIX package built with complete documentation and checksums. |
