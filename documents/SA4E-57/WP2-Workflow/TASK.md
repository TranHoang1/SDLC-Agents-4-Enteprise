# TASK — Work Package 2: Workflow Interpreter Engine

## 1. Summary

Build a workflow simulation engine that understands Pega flow shapes, their semantics, and how work items progress through process flows. The engine constructs a directed graph from flow shape JSON, evaluates routing conditions (via WP1), and tracks work item state through Assign → Route → Approval → Subprocess → End chains.

Reference: [Upgrade Plan §4](../SA4E-56/pega-parser-upgrade-plan.md#4-work-package-2-workflow-interpreter-engine)

## 2. Scope

### 2.1 Shape Types Covered

| Pega Shape | Handler | Behavior |
|-----------|---------|----------|
| **Assign** | `PegaAssignHandler` | Route work to work party (operator/role/org), create assignment, track deadline |
| **Route** | `PegaRouteHandler` | Evaluate connector conditions, select first matching path |
| **Approval** | `PegaApprovalHandler` | Multi-level approval chain with accept/reject logic |
| **Utility** | Executes Activity/DataTransform ref | Calls expression evaluator for referenced rule |
| **Subprocess** | Spawns child WorkItem on referenced Flow | Nested flow execution with parent context |
| **Wait** | Suspends until event or timeout | Simulated as no-op or conditional continuation |
| **Notification** | Logged event (non-blocking) | Simulated as log entry |
| **SLA** | `PegaSlaEngine` | Calculate goal/deadline, urgency escalation |

### 2.2 Flow Graph Construction
- Parse flow shapes from `pyShapes` array
- Parse connectors from `pyConnectors` / shape link data
- Build adjacency list: `Map<shapeId, { shape, outgoingEdges[] }>`
- Each edge has: targetId, condition (When rule ref or expression), priority

### 2.3 Work Item State Machine
- States: `Idle`, `InProgress`, `Resolved`, `Failed`, `TimedOut`
- Tracks: current shape ID, completed shapes list, assignments, deadlines
- History log: `{ shapeId, action, timestamp, result }`

### 2.4 SLA Calculation
- Goal time, deadline, urgency from SLA configuration properties
- Timer model: simulated (not wall-clock), based on configurable tick duration
- Escalation: urgency increase after goal time exceeded

## 3. Components

| Component | File | Responsibility |
|-----------|------|----------------|
| **PegaFlowGraphBuilder** | `backend/src/modules/pega/workflow/PegaFlowGraphBuilder.ts` | Parse shapes + connectors → directed graph with edge conditions |
| **PegaFlowGraph** | `backend/src/modules/pega/workflow/PegaFlowGraph.ts` | Graph data structure: nodes (shapes), edges (connectors with conditions) |
| **PegaWorkflowEngine** | `backend/src/modules/pega/workflow/PegaWorkflowEngine.ts` | Main orchestrator: init flow, advance through graph, evaluate routing decisions |
| **PegaWorkItem** | `backend/src/modules/pega/workflow/PegaWorkItem.ts` | Work item state: current node, history, assignments, SLA data |
| **PegaShapeHandler** | `backend/src/modules/pega/workflow/shapes/PegaShapeHandler.ts` | Abstract base class for all shape handlers |
| **PegaAssignHandler** | `backend/src/modules/pega/workflow/shapes/PegaAssignHandler.ts` | Route assignment to work party, create task, handle deadline |
| **PegaRouteHandler** | `backend/src/modules/pega/workflow/shapes/PegaRouteHandler.ts` | Evaluate connector conditions, select path |
| **PegaApprovalHandler** | `backend/src/modules/pega/workflow/shapes/PegaApprovalHandler.ts` | Approval chain stages, actor resolution, accept/reject logic |
| **PegaSlaEngine** | `backend/src/modules/pega/workflow/PegaSlaEngine.ts` | Calculate goal/deadline from SLA config, track elapsed time |
| **PegaWorkPartyResolver** | `backend/src/modules/pega/workflow/PegaWorkPartyResolver.ts` | Resolve work party references (operator, role, org) to actor lists |
| **PegaUtilityHandler** | `backend/src/modules/pega/workflow/shapes/PegaUtilityHandler.ts` | Execute referenced Activity/DataTransform |
| **PegaSubprocessHandler** | `backend/src/modules/pega/workflow/shapes/PegaSubprocessHandler.ts` | Spawn child WorkItem on referenced Flow |
| **PegaWaitHandler** | `backend/src/modules/pega/workflow/shapes/PegaWaitHandler.ts` | Suspend until event or timeout condition |
| **PegaNotificationHandler** | `backend/src/modules/pega/workflow/shapes/PegaNotificationHandler.ts` | Simulate notification as log event |

## 4. Effort: 10 person-weeks

| Activity | Weeks | Dependencies |
|----------|-------|-------------|
| Flow graph data model (nodes, edges, conditions) | 1 | None |
| Flow graph builder from shape JSON | 1 | Graph model |
| Core workflow state machine + WorkItem | 2 | Graph builder |
| Assign + Route shape handlers | 2 | WP1 (expression for conditions) |
| Approval handler (multi-level chain) | 1.5 | Assign + Route handlers |
| SLA engine | 1 | Core state machine |
| Subprocess + Utility + Notification + Wait handlers | 1 | Core state machine |

## 5. Dependencies

| Dependency | Type | Notes |
|-----------|------|-------|
| WP1 — Expression Language Parser | Strong | Route conditions, assignment routing expressions |
| `PegaRuleAstParser` (existing) | Internal | Reuse reference extraction for flow action refs |
| WP3 — Decision evaluator | Weak | If flow action is a decision table |
| Sample Flow JSON exports | External | Flows with Assign, Route, Approval shapes + connectors |

## 6. Out of Scope
- Real-time wall-clock SLA enforcement (simulated only)
- Integration connector execution (Rule-Connect-*)
- Pega 7.x legacy shape models (Pega 8.x target)
- Work item persistence to database