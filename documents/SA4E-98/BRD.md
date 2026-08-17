# Business Requirements Document (BRD)

## Pega Graph — SA4E-98: Real OOP Edge Extraction During Ingest + Reconciliation

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-98 |
| Title | [Pega Graph] Real OOP edge extraction during ingest + reconciliation |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2025-07-27 |
| Status | Retroactive (code already implemented) |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent – Business Analyst | Create document |
| Peer Reviewer | TA Agent – Technical Architect | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-27 | BA Agent | Retroactive BRD — auto-generated from implemented code for SA4E-98 |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |

---

## 1. Introduction

### 1.1 Scope

SA4E-98 addresses the critical problem of **empty `graph_edges` table** in the Pega Knowledge Graph. Prior to this feature, Pega rules ingested into `graph_nodes` had no dependency edges connecting them because target nodes typically did not exist at ingest time (dependencies are ingested out-of-order). This resulted in a disconnected, useless graph visualization in the 3D viewport.

The solution implements a multi-strategy edge extraction pipeline:
1. **Forward edge creation** — create edges at ingest time regardless of target existence
2. **Reverse-link validation** — when a new node is inserted, validate existing orphaned edges pointing to it
3. **Full reconciliation** — on startup or on-demand, re-scan all Pega nodes and backfill missing edges
4. **Synthetic edge fallback** — when graph_edges remains empty, generate visual connectivity for the 3D viewport

### 1.2 Out of Scope

- Pega rule parsing logic changes (PegaParser remains unchanged)
- Graph visualization UI changes (frontend consumes edges as-is)
- Cross-project edge reconciliation (scoped per project)
- Performance optimization of large-scale reconciliation (handled post-MVP)

### 1.3 Preliminary Requirement

- SA4E-97 (Graph reprojection with type-based clustering) must be complete — provides node positioning infrastructure
- Pega rules ingested into `knowledge_entries` table with parseable JSON content
- `graph_nodes` table populated with `pega:*` entries via `projectRuleToGraphNode()`
- `graph_edges` table schema exists with `(source, target, weight, rel_type)` columns

---

## 2. Business Requirements

### 2.1 High Level Process Map

The Pega Knowledge Graph edge extraction operates across three phases:

1. **Ingest Phase** — When a Pega rule is ingested, extract its dependencies and create forward edges immediately (even if target nodes don't yet exist)
2. **Reverse-Link Phase** — When any new Pega node is created, check if existing edges already reference it as a target
3. **Reconciliation Phase** — On system startup or admin request, scan all stored rules, re-extract dependencies, and backfill any missing edges

![Business Flow](diagrams/business-flow.png)

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case / Epic | Priority | Source Ticket |
|---|-------------------------|----------|---------------|
| 1 | As a developer using the 3D graph viewport, I want to see real dependency connections between Pega rules so that I can understand the architecture | MUST HAVE | SA4E-98 |
| 2 | As a system administrator, I want to trigger a full edge reconciliation on-demand so that I can fix any missing edges without restarting | MUST HAVE | SA4E-98 |
| 3 | As a system operator, I want edges to auto-reconcile on startup when the graph is sparse so that the graph is always usable | MUST HAVE | SA4E-98 |
| 4 | As a developer browsing the graph, I want to see typed relationships (CALLS, INHERITS, etc.) so that I can understand the nature of each dependency | SHOULD HAVE | SA4E-98 |
| 5 | As a user viewing a newly started system with no edges yet, I want to see synthetic visual connectivity so that the graph doesn't appear broken | COULD HAVE | SA4E-98 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** User/system ingests a Pega rule via `PegaService.ingestRule()`

**Step 2:** System parses the rule JSON and extracts unresolved dependencies (class references, activity calls, property usages, etc.)

**Step 3:** System creates forward edges from source node to target node IDs (constructed from dependency FQN) regardless of target existence

**Step 4:** System projects the rule into `graph_nodes` and obtains its `graphNodeId`

**Step 5:** System runs `linkReverseEdges()` — checks if any previously-created edges reference this new node as target

**Step 6:** On startup, `KBGraphModule.autoReconcileEdges()` checks edge/node ratio; if ratio < 0.5, runs full reconciliation

**Step 7:** If graph_edges remains empty after all strategies, frontend receives synthetic hub+chain edges for visual connectivity

> **Note:** Steps 1-5 occur per-rule during real-time ingest. Step 6 is a background startup task. Step 7 is a read-time fallback.

---

#### STORY 1: Real Dependency Edge Creation During Ingest

> As a developer using the 3D graph viewport, I want to see real dependency connections between Pega rules so that I can understand the architecture

**Requirement Details:**

1. When `PegaService.ingestRule()` is called, after parsing the rule JSON, the system MUST extract all dependencies via `PegaParser.extractDependencies()`
2. For each dependency, the system MUST create an edge in `graph_edges` with:
   - `source` = the current rule's graph node ID (format: `pega:{ruleType}:{className}:{ruleName}`)
   - `target` = constructed target node ID from dependency metadata
   - `weight` = 0.7 (default semantic weight for Pega dependencies)
   - `rel_type` = mapped relationship type based on dependency's `ruleType`
3. Edge creation MUST use `INSERT OR IGNORE` (SQLite) / `ON CONFLICT DO NOTHING` (PostgreSQL) to handle duplicates
4. Edge creation failure MUST be non-fatal — silently continue on error

**Relationship Type Mapping:**

| Dependency ruleType Contains | Relationship Type | Meaning |
|------------------------------|-------------------|---------|
| FlowAction | CONTAINS | Flow contains FlowAction steps |
| Activity, Flow | CALLS | Rule calls another Activity/Flow |
| Class | INHERITS | Class inheritance |
| Property | HAS_PROPERTY | Class references a Property |
| Connect | CONNECTS_TO | Connector references external system |
| When, Decision | EVALUATES | Decision/When references condition |
| Model, Transform | USES | Rule references Data Transform/Model |
| Section | REFERENCES | Section embeds another Section |

**Acceptance Criteria:**

1. After ingesting a Pega Activity that calls 3 other Activities, `graph_edges` contains 3 rows with `rel_type = 'CALLS'`
2. After ingesting a Class that inherits from a parent, `graph_edges` contains 1 row with `rel_type = 'INHERITS'`
3. Edges are created even if target nodes don't exist yet in `graph_nodes`
4. Duplicate edge insertion does not throw errors
5. Ingest latency increase is < 50ms per rule (edge creation is lightweight)

---

#### STORY 2: On-Demand Edge Reconciliation (Admin)

> As a system administrator, I want to trigger a full edge reconciliation on-demand so that I can fix any missing edges without restarting

**Requirement Details:**

1. The system MUST expose a POST endpoint at `/api/admin/kb/graph/reconcile-edges`
2. The endpoint MUST be protected by admin-only RBAC (`RBAC_MANAGE` permission)
3. Reconciliation MUST:
   - Scan all `graph_nodes` entries with `entry_id LIKE 'pega:%'`
   - For each node, retrieve its stored rule JSON from `knowledge_entries`
   - Parse the JSON and re-extract dependencies using `PegaParser`
   - Insert missing edges using `INSERT OR IGNORE`
4. The endpoint MUST return a summary: `{ edgesCreated, nodesScanned, errors }`

**Acceptance Criteria:**

1. POST `/api/admin/kb/graph/reconcile-edges` returns 200 with reconciliation stats
2. Non-admin users receive 403 Forbidden
3. After reconciliation, edge count increases for previously edge-less nodes
4. Parse errors in stored JSON are counted but do not abort the process
5. Endpoint completes within 30 seconds for up to 1,500 nodes

---

#### STORY 3: Auto-Reconciliation on Startup

> As a system operator, I want edges to auto-reconcile on startup when the graph is sparse so that the graph is always usable

**Requirement Details:**

1. During `KBGraphModule.initialize()`, the system MUST check the edge/node ratio for Pega nodes
2. If `edges / nodes < 0.5` (less than 0.5 edges per Pega node), the system MUST trigger `reconcileAllEdges()`
3. Auto-reconciliation MUST run asynchronously (non-blocking to startup)
4. Auto-reconciliation MUST be non-fatal — errors are logged but do not crash the server
5. If there are 0 Pega nodes, reconciliation is skipped

**Acceptance Criteria:**

1. On fresh startup with 100 Pega nodes and 0 edges, reconciliation runs automatically
2. On startup with 100 Pega nodes and 80 edges (ratio 0.8), reconciliation is skipped
3. Reconciliation failure logs a warning but server continues normally
4. Startup time increase is < 5 seconds for typical Pega application (< 1,500 rules)

---

#### STORY 4: Typed Relationship Edges

> As a developer browsing the graph, I want to see typed relationships (CALLS, INHERITS, etc.) so that I can understand the nature of each dependency

**Requirement Details:**

1. The system MUST support 8 distinct relationship types: CALLS, INHERITS, HAS_PROPERTY, CONNECTS_TO, EVALUATES, USES, CONTAINS, REFERENCES
2. Relationship type MUST be stored in `graph_edges.rel_type` column
3. Relationship type MUST be deterministically derived from the dependency's `ruleType` field
4. Frontend receives `type` field in edge payloads from `getAllPositions()` API

**Acceptance Criteria:**

1. Each edge in `graph_edges` has a non-null `rel_type` value from the 8 supported types
2. Given a Flow rule with FlowAction dependencies, edges are typed CONTAINS
3. Given a Class with a parent class reference, edge is typed INHERITS
4. The `getAllPositions()` API response includes `type` for each edge

---

#### STORY 5: Reverse-Link Validation on Node Insert

> As a developer browsing the graph, I want edges created before a target node existed to become valid when that target is eventually ingested

**Requirement Details:**

1. After a new Pega node is projected into `graph_nodes`, the system MUST call `linkReverseEdges(adapter, graphNodeId)`
2. `linkReverseEdges()` MUST query `graph_edges` for edges where `target = newNodeId`
3. This validates that previously-created forward edges (from Story 1) are now resolvable
4. The function returns the count of existing edges pointing to this node (informational)

**Acceptance Criteria:**

1. When Rule A references Rule B, and Rule A is ingested first, edge (A to B) is created with target `pega:...:B`
2. When Rule B is subsequently ingested, `linkReverseEdges()` finds the existing edge and returns count=1
3. No new edges are created by reverse-link — it only validates existing ones
4. Performance: < 5ms per node for reverse-link check

---

#### STORY 6: Synthetic Edge Fallback for Empty Graphs

> As a user viewing a newly started system with no edges yet, I want to see synthetic visual connectivity so that the graph doesn't appear broken

**Requirement Details:**

1. In `getAllPositions()`, if `graph_edges` returns 0 rows AND there are multiple node types, the system MUST generate synthetic edges
2. Synthetic edges include:
   - **Hub spanning tree**: Connect first node of each type-cluster to create inter-cluster bridges (type: `TYPE_BRIDGE`, weight: 0.3)
   - **Intra-cluster chains**: Connect sequential nodes within each cluster (~20 edges per cluster, type: `CLUSTER_LINK`, weight: 0.5)
3. Synthetic edges are NOT persisted — they are generated at read-time only
4. Once real edges exist (from reconciliation or ingest), synthetic edges are no longer generated

**Acceptance Criteria:**

1. With 5 node types and 0 stored edges, API returns 4 TYPE_BRIDGE edges + intra-cluster CLUSTER_LINK edges
2. After reconciliation populates real edges, synthetic edges disappear from API response
3. Synthetic edges do not appear in `graph_edges` table
4. Frontend renders a connected graph even before first reconciliation completes

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| SA4E-97 | System | SA4E-97 | Graph node reprojection — provides node spatial positions and type-based clustering |
| PegaParser | System | N/A | Existing parser that extracts `UnresolvedDependency[]` from rule JSON |
| graph_edges schema | Infrastructure | N/A | Table with columns: id, source, target, weight, rel_type + unique(source,target) |
| graph_nodes schema | Infrastructure | N/A | Table with columns: id, entry_id, x, y, z, type, tier, label, project_id |
| knowledge_entries | Infrastructure | N/A | Stores raw Pega rule JSON content (used during reconciliation) |
| RBAC system | System | N/A | Admin permission check for reconciliation endpoint |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Developer | Development Team | Implement and maintain edge extraction pipeline | Assignee |
| Technical Architect | TA Agent | Review architecture and data flow design | Reviewer |
| End Users | Developers using 3D graph | Consume graph with real dependency edges | Beneficiary |
| Administrators | System admins | Trigger on-demand reconciliation | Operator |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Reconciliation timeout for very large Pega apps (>5,000 rules) | Medium | Low | Batch processing with progress tracking |
| Orphaned edges accumulate (target never ingested) | Low | Medium | Periodic cleanup or TTL on unresolved edges |
| Edge/node ratio heuristic (0.5) triggers unnecessary reconciliation | Low | Low | Tunable threshold; skip if recently reconciled |
| PegaParser changes break dependency extraction | High | Low | Versioned parser interface; unit tests for extraction |
| Concurrent ingest + reconciliation causes duplicate edge attempts | Low | Medium | INSERT OR IGNORE handles gracefully |

### 5.2 Assumptions

- Pega rules stored in `knowledge_entries` have valid JSON content parseable by PegaParser
- Target node IDs are deterministically constructable from dependency metadata (`{ruleType}:{className}:{ruleName}`)
- Edge weight of 0.7 is appropriate for all Pega dependency types (may need tuning later)
- The edge/node ratio threshold of 0.5 is a reasonable heuristic for "sparse graph"
- Frontend can render graphs with mixed real + synthetic edges seamlessly

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Edge creation latency | < 50ms added per rule during ingest |
| Performance | Full reconciliation | < 30 seconds for 1,500 nodes |
| Performance | Reverse-link check | < 5ms per new node |
| Reliability | Non-fatal errors | All edge operations are non-fatal; failures logged, server continues |
| Scalability | Node count | Supports up to 5,000 Pega nodes per project |
| Data Integrity | Idempotency | Repeated reconciliation produces identical results (INSERT OR IGNORE) |
| Availability | Startup impact | Auto-reconciliation runs in background; does not block server readiness |
| Security | Access control | On-demand reconciliation restricted to RBAC_MANAGE permission |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| SA4E-98 | [Pega Graph] Real OOP edge extraction during ingest + reconciliation | Done | Story | Main ticket |
| SA4E-97 | [Pega Graph] Node reprojection with type-based clustering | Done | Story | Prerequisite — provides node positioning |
| SA4E-51 | KB Graph Module architecture | Done | Story | Parent — module infrastructure |
| SA4E-53 | Spatial graph query API | Done | Story | Related — getAllPositions endpoint |

---

## 8. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
| 2 | Business Flow Diagram | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |

### Glossary

| Term | Definition |
|------|------------|
| Forward Edge | An edge created at ingest time where target may not yet exist in graph_nodes |
| Reverse-Link | Validation step: when a new node is created, check if existing edges point to it |
| Reconciliation | Full scan of stored rules to re-extract and backfill missing edges |
| Synthetic Edge | Read-time generated edge for visual connectivity when no real edges exist |
| Edge/Node Ratio | Heuristic metric: number of edges divided by number of Pega nodes; below 0.5 indicates sparse |
| FQN | Fully Qualified Name: `{ruleType}:{className}:{ruleName}` uniquely identifies a Pega rule |
| rel_type | Relationship type stored on an edge (CALLS, INHERITS, HAS_PROPERTY, etc.) |

### Reference Documents

| Document | Link / Location |
|----------|-----------------|
| PegaGraphProjector.ts | backend/src/modules/pega/PegaGraphProjector.ts |
| PegaService.ts | backend/src/modules/pega/PegaService.ts |
| KBGraphModule.ts | backend/src/modules/kb-graph/KBGraphModule.ts |
| kb-graph.ts (routes) | backend/src/server/routes/admin/kb-graph.ts |
| spatial.ts | backend/src/modules/kb-graph/service/spatial.ts |
