# Software Test Cases (STC)

## SDLC Agents 4 Enterprise — SA4E-67: Semantic Understanding + Reference Analysis

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-67 |
| Title | Semantic Understanding + Reference Analysis |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-07-27 |
| Status | Draft |
| Related STP | STP.md |
| Related FSD | FSD.md |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-27 | QA Agent | Initiate document — 20 test cases covering all 4 WPs |

---

## Test Case Summary

| Category | ID Range | Count | Priority |
|----------|----------|-------|----------|
| WP1 — Semantic Analyzer | TC-SA-01 to TC-SA-07 | 7 | High |
| WP2 — Rule Simulator | TC-RS-01 to TC-RS-06 | 6 | High |
| WP3 — Reference Extractor | TC-RE-01 to TC-RE-04 | 4 | High |
| WP4 — Impact Analyzer | TC-IA-01 to TC-IA-03 | 3 | High |
| **Total** | | **20** | |

---

## 1. WP1 — PegaSemanticAnalyzer Tests

### TC-SA-01: Activity analysis with all step types

| Field | Value |
|-------|-------|
| **ID** | TC-SA-01 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | BRD BR-01, FSD WP1-FR-01 |
| **Preconditions** | PegaSemanticAnalyzer class available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create Activity JSON with 5 steps: Call("Other.ActivityA"), Property-Set(".Status", "Open"), Obj-Save, Page-New(".TempPage"), step with no method | |
| 2 | Call analyzer.analyze(activityJson) | SemanticAnalysis returned |
| 3 | Check summary | Includes "calls activity" and "sets property" text |
| 4 | Check sideEffects | 4 side effects: api_call (Call → ActivityA), page_update (Property-Set → Status), db_write (Obj-Save), page_update (Page-New → .TempPage) |
| 5 | Check dependencies | 1 dependency of type "activity" targeting "ActivityA" |
| 6 | Check dataFlow | 1 dataFlow entry for Property-Set |

**Test Data:** Activity JSON with 5 mixed steps
**Postconditions:** All side effects, dependencies, and data flows correctly identified

---

### TC-SA-02: Activity with when condition skipping

| Field | Value |
|-------|-------|
| **ID** | TC-SA-02 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | BRD BR-01 |
| **Preconditions** | PegaSemanticAnalyzer available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create Activity JSON with 2 steps: Step1 (Property-Set, whenCondition=".Status=Open"), Step2 (Call) | |
| 2 | Call analyzeActivity | Summary includes both steps |
| 3 | Check conditions | 1 condition with field=".Status=Open", operator="WHEN", value=true |

**Test Data:** Activity with when-condition guard
**Postconditions:** When condition captured in condition summary

---

### TC-SA-03: DataTransform field mapping analysis

| Field | Value |
|-------|-------|
| **ID** | TC-SA-03 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | BRD BR-01, FSD WP1-FR-02 |
| **Preconditions** | PegaSemanticAnalyzer available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create DT JSON with 2 Set actions: Set .Source→.Target, Set .A→.B, and 1 Apply Data Transform action for "SubTransform" | |
| 2 | Call analyzeDataTransform | SemanticAnalysis with 2 propertyMappings |
| 3 | Check propertyMappings[0] | from="Source", to="Target" |
| 4 | Check propertyMappings[1] | from="A", to="B" |
| 5 | Check dependencies | 1 dependency of type "data_transform" targeting "SubTransform" |
| 6 | Check dataFlow | 2 dataFlow entries for Set actions |

**Test Data:** DT JSON with 3 actions
**Postconditions:** Correct mappings and sub-transform dependency

---

### TC-SA-04: Flow shape and route analysis

| Field | Value |
|-------|-------|
| **ID** | TC-SA-04 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | BRD BR-01, FSD WP1-FR-03 |
| **Preconditions** | PegaSemanticAnalyzer available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create Flow JSON with 4 shapes: Start, Assign (flowActionName="CollectData"), Route (whenCondition=".Status=Approved"), End | |
| 2 | Call analyzeFlow | SemanticAnalysis with shapeTypes: [Start, Assign, Route, End] |
| 3 | Check summary | Contains "starts at", "routes through", "ends at" |
| 4 | Check dependencies | 1 dependency of type "flow_action" targeting "CollectData" |
| 5 | Check conditions | 1 condition for Route when |

**Test Data:** Flow with Start→Assign→Route→End
**Postconditions:** Correct route description and dependency extraction

---

### TC-SA-05: DecisionTable condition row analysis

| Field | Value |
|-------|-------|
| **ID** | TC-SA-05 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | BRD BR-01, FSD WP1-FR-04 |
| **Preconditions** | PegaSemanticAnalyzer available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create DecisionTable JSON with 2 rows: Row1 (cond=".Amount > 1000", result="{Discount:15}"), Row2 (cond=".Status = Silver", result="{Discount:10}"), plus pyReturnActions with pyTransformName="ApplyDiscount" | |
| 2 | Call analyzeDecision | SemanticAnalysis with decisionRows=2 |
| 3 | Check conditions | 2 conditions parsed with field/operator/value |
| 4 | Check dependencies | 1 dependency of type "data_transform" targeting "ApplyDiscount" |

**Test Data:** DecisionTable with 2 rows + return action
**Postconditions:** Conditions parsed, trigger dependencies found

---

### TC-SA-06: Section field and layout extraction

| Field | Value |
|-------|-------|
| **ID** | TC-SA-06 |
| **Priority** | Medium |
| **Type** | Functional — Unit |
| **Requirement** | BRD BR-01, FSD WP1-FR-05 |
| **Preconditions** | PegaSemanticAnalyzer available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create Section JSON with DynamicLayout (pyLayoutType="dynamic"), containing fields with pyPropertyName="Name", "Status", "Amount" | |
| 2 | Call analyzeSection | SemanticAnalysis with 3 renderedFields |
| 3 | Check renderedFields | ["Name", "Status", "Amount"] |
| 4 | Check layoutTypes | ["dynamic"] |

**Test Data:** Section with 3 fields in dynamic layout
**Postconditions:** All fields and layout types extracted

---

### TC-SA-07: Connect and Declare analysis

| Field | Value |
|-------|-------|
| **ID** | TC-SA-07 |
| **Priority** | Medium |
| **Type** | Functional — Unit |
| **Requirement** | BRD BR-01, FSD WP1-FR-06, WP1-FR-07 |
| **Preconditions** | PegaSemanticAnalyzer available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create Connect-REST JSON: baseURL="https://api.example.com", resourcePath="/orders", httpMethod="POST", authType="Basic" | |
| 2 | Call analyzeConnect | api_call side effect with target URL |
| 3 | Check httpMethod | "POST" |
| 4 | Create Declare-Expressions JSON: targetProp=".Total", expression=".Quantity * .Price", whenCondition=".IsActive=true" | |
| 5 | Call analyzeDeclare | dataFlow with expression transform and input refs |
| 6 | Check targetProperty | ".Total" |

**Test Data:** Connect-REST + Declare-Expressions JSON
**Postconditions:** Connect endpoint details and declare expression analysis correct

---

## 2. WP2 — PegaRuleSimulator Tests

### TC-RS-01: Activity simulation with step execution

| Field | Value |
|-------|-------|
| **ID** | TC-RS-01 |
| **Priority** | High |
| **Type** | Functional — Integration |
| **Requirement** | BRD BR-02, FSD WP2-FR-01 |
| **Preconditions** | PegaRuleSimulator available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create Activity JSON with 3 steps: Step1 (Property-Set ".Status"), Step2 (Call "SubActivity"), Step3 (Obj-Save "Order") | |
| 2 | Create SimulationRequest with pxObjClass="Rule-Obj-Activity" | |
| 3 | Call simulator.simulate(request) | SimulationResult with success=true |
| 4 | Check trace length | At least 5 entries: start, set, call, db_write, complete |
| 5 | Check trace actions | Includes "start", "set", "call", "db_write", "complete" |
| 6 | Check executionTimeMs | > 0 |

**Test Data:** Activity with 3 diverse steps
**Postconditions:** Complete trace with all step types

---

### TC-RS-02: Activity simulation with when-condition skip

| Field | Value |
|-------|-------|
| **ID** | TC-RS-02 |
| **Priority** | High |
| **Type** | Functional — Integration |
| **Requirement** | BRD BR-02, FSD WP2-FR-01 |
| **Preconditions** | PegaRuleSimulator, PegaExpressionEvaluator available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create Activity JSON with 2 steps: Step1 (Property-Set, whenCondition="false"), Step2 (Call "ActivityA") | |
| 2 | Set clipboard to empty (no matching property for "false" — treated as false) | |
| 3 | Create SimulationRequest with inputClipboard={} | |
| 4 | Call simulate(request) | SimulationResult with success=true |
| 5 | Check trace includes "skip" | At least one skip action for Step1 |
| 6 | Check trace includes "call" | Step2 executed (Call) |

**Test Data:** Activity with false when-condition guard
**Postconditions:** Guarded step skipped, remaining steps executed

---

### TC-RS-03: Flow simulation through WorkflowEngine

| Field | Value |
|-------|-------|
| **ID** | TC-RS-03 |
| **Priority** | High |
| **Type** | Functional — System |
| **Requirement** | BRD BR-02, FSD WP2-FR-03 |
| **Preconditions** | PegaRuleSimulator, PegaWorkflowEngine, PegaFlowGraph available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create Flow JSON with 3 shapes: Start (pyName="Start1"), Assign (pyName="Assign1"), End (pyName="End1") — all with pyShapeType set | |
| 2 | Create SimulationRequest with pxObjClass="Rule-Obj-Flow" | |
| 3 | Call simulate(request) | SimulationResult with success=true |
| 4 | Check trace includes "flow_step" | At least 1 flow_step log from WorkflowEngine |
| 5 | Check last trace action | "complete" |

**Test Data:** Simple 3-shape flow
**Postconditions:** Flow simulation produces WorkflowEngine-based trace

---

### TC-RS-04: DecisionTable evaluation simulation

| Field | Value |
|-------|-------|
| **ID** | TC-RS-04 |
| **Priority** | High |
| **Type** | Functional — Integration |
| **Requirement** | BRD BR-02, FSD WP2-FR-04 |
| **Preconditions** | PegaRuleSimulator, PegaDecisionTableEvaluator available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create DecisionTable JSON with 2 rows: Row1 (cond=".Amount > 1000"), Row2 (cond=".Status = Silver") | |
| 2 | Set clipboard with Status="Silver" | |
| 3 | Call simulate(request) with pxObjClass="Rule-Declare-DecisionTable" | success=true |
| 4 | Check trace includes "eval" | At least 1 eval event |
| 5 | Check trace includes "matched" or "no_match" | Final status event present |

**Test Data:** DecisionTable with 2 rows, clipboard having Silver status
**Postconditions:** Decision table evaluated, trace recorded

---

### TC-RS-05: DataTransform simulation with Set actions

| Field | Value |
|-------|-------|
| **ID** | TC-RS-05 |
| **Priority** | High |
| **Type** | Functional — Integration |
| **Requirement** | BRD BR-02, FSD WP2-FR-02 |
| **Preconditions** | PegaRuleSimulator available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create DT JSON with pyActions: Set action (type="Set", source=".SourceField", target=".TargetField") | |
| 2 | Create SimulationRequest with pxObjClass="Rule-Obj-Model" | |
| 3 | Call simulate(request) | success=true |
| 4 | Check trace actions | "start", "set" (with mapping detail), "complete" |

**Test Data:** DataTransform with single Set action
**Postconditions:** DT simulation trace with correct action types

---

### TC-RS-06: Unsupported rule type returns error

| Field | Value |
|-------|-------|
| **ID** | TC-RS-06 |
| **Priority** | High |
| **Type** | Functional — Exception Flow |
| **Requirement** | FSD WP2 |
| **Preconditions** | PegaRuleSimulator available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create request with pxObjClass="Rule-Obj-Section" (unsupported by simulator) | |
| 2 | Call simulate(request) | success=false |
| 3 | Check errors | Contains "Unsupported rule type: Rule-Obj-Section" |
| 4 | Check trace | 1 entry with action="unsupported" |

**Test Data:** Unsupported rule type
**Postconditions:** Graceful error handling

---

## 3. WP3 — PegaReferenceExtractor Tests

### TC-RE-01: Activity step reference extraction

| Field | Value |
|-------|-------|
| **ID** | TC-RE-01 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | BRD BR-03, FSD WP3-FR-01 |
| **Preconditions** | PegaReferenceExtractor available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create Activity JSON with 2 steps: Step1 (pyMethod="Call", pyMethodParameters="OtherClass.OtherActivity"), Step2 (pyWhenCondition="CheckStatus") | |
| 2 | Call extractFromRule(activityJson) | Array of ResolvedDependency |
| 3 | Check first dep | type="Rule-Obj-Activity", name="OtherActivity", relation="calls" |
| 4 | Check second dep | type="Rule-Obj-When", name="CheckStatus", relation="references" |
| 5 | Ensure no self-references | pyRuleName field not treated as dependency |

**Test Data:** Activity with Call step and when condition
**Postconditions:** Activity reference and when reference extracted

---

### TC-RE-02: Known field map and convention suffix extraction

| Field | Value |
|-------|-------|
| **ID** | TC-RE-02 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | BRD BR-03, FSD WP3-FR-01 |
| **Preconditions** | PegaReferenceExtractor available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create Flow JSON with: pyFlowActionName="CollectData", pyWhenCondition="IsApproved", pySuperClass="TGB-Work-Candidate", pyAuthProfile="BasicAuth" | |
| 2 | Call extractFromRule(flowJson) | 4 dependencies extracted |
| 3 | Check pyFlowActionName dep | type="Rule-Obj-FlowAction", name="CollectData", relation="references" |
| 4 | Check pyWhenCondition dep | type="Rule-Obj-When", name="IsApproved", relation="references" |
| 5 | Check pySuperClass dep | type="Rule-Obj-Class", name="TGB-Work-Candidate", relation="extends" |
| 6 | Check pyAuthProfile dep | type="Rule-Connect-AuthProfile", name="BasicAuth", relation="configures" |

**Test Data:** Flow JSON with 4 known reference fields
**Postconditions:** All known field references correctly typed

---

### TC-RE-03: Dependency graph construction and cycle detection

| Field | Value |
|-------|-------|
| **ID** | TC-RE-03 |
| **Priority** | High |
| **Type** | Functional — System |
| **Requirement** | BRD BR-03, BR-05, FSD WP3-FR-02, WP3-FR-03 |
| **Preconditions** | PegaReferenceExtractor available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create 3 Activity JSONs: ActivityA calls ActivityB, ActivityB calls ActivityC, ActivityC calls ActivityA (cycle) | |
| 2 | Call buildGraph([activityA, activityB, activityC]) | DependencyGraph with 3 nodes, 3 edges |
| 3 | Call findCycles(graph) | 1 cycle: [A, B, C, A] (or similar) |
| 4 | Call findOrphans(graph) | No orphans (all rules referenced as targets) |
| 5 | Remove ActivityA from the graph | |
| 6 | Call findOrphans again | ActivityA is now an orphan |

**Test Data:** 3 activities forming a cycle
**Postconditions:** Cycle detected, orphan detection correct

---

### TC-RE-04: Transitive dependent resolution

| Field | Value |
|-------|-------|
| **ID** | TC-RE-04 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | BRD BR-05, FSD WP3-FR-05 |
| **Preconditions** | PegaReferenceExtractor available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create chain: ActivityA calls ActivityB, ActivityB calls ActivityC | |
| 2 | Build graph from all 3 | 3 nodes, 2 edges |
| 3 | Call getDependents("ActivityA", graph) | [] (nothing depends on A) |
| 4 | Call getDependents("ActivityC", graph) | ["ActivityB"] (B depends on C) |
| 5 | Call getAllDependents("ActivityC_fqn", graph) | ["ActivityB", "ActivityA"] (A depends on B, which depends on C) |

**Test Data:** 3-activity call chain
**Postconditions:** Direct and transitive dependents correctly resolved

---

## 4. WP4 — PegaImpactAnalyzer Tests

### TC-IA-01: Impact scope with transitive dependent chain

| Field | Value |
|-------|-------|
| **ID** | TC-IA-01 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | BRD BR-04, FSD WP4-FR-01, WP4-FR-02 |
| **Preconditions** | PegaImpactAnalyzer available, dependency graph built |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Build a 4-rule dependency chain: TopFlow → MiddleFlow → BottomFlow → LeafUtil (all Rule-Obj-Activity) | |
| 2 | Call analyzeChange("LeafUtil", graph) | ImpactAnalysis for LeafUtil |
| 3 | Check directDependents | Contains "BottomFlow" (1 direct dependent) |
| 4 | Check indirectDependents | Contains "MiddleFlow" and "TopFlow" (transitive chain resolved) |
| 5 | Check impactScope | Valid scope string (local/module/crossModule/system) |
| 6 | Check risk | Valid risk level (low/medium/high) |
| 7 | Call analyzeChange("TopFlow", graph) | TopFlow has no dependents |

**Test Data:** 4-rule dependency chain (all single-category Activity rules)
**Postconditions:** Direct and transitive dependents correctly resolved, scope/risk return valid values

> Note: Full cross-category system-level scope tests (multi-category graph) are planned for a future enhancement.

---

### TC-IA-02: Local scope change with no dependents

| Field | Value |
|-------|-------|
| **ID** | TC-IA-02 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | BRD BR-04, FSD WP4-FR-01, WP4-FR-02 |
| **Preconditions** | PegaImpactAnalyzer available, graph with isolated node |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Build graph where "IsolatedRule" has no edges (no other rule references it) | |
| 2 | Call analyzeChange("IsolatedRule", graph) | ImpactAnalysis |
| 3 | Check impactScope | "local" |
| 4 | Check risk | "low" |
| 5 | Check directDependents | Empty array |
| 6 | Check suggestedTests | Contains rule type-specific test (e.g., "Activity test") |
| 7 | Check suggestedTests does NOT contain regression/E2E | No high-risk tests suggested |

**Test Data:** Graph with isolated rule (no dependents)
**Postconditions:** Local scope, low risk, minimal test suggestions

---

### TC-IA-03: Batch analysis and DOT export

| Field | Value |
|-------|-------|
| **ID** | TC-IA-03 |
| **Priority** | High |
| **Type** | Functional — System |
| **Requirement** | BRD BR-04, FSD WP4-FR-03, WP4-FR-04 |
| **Preconditions** | PegaImpactAnalyzer available, dependency graph built |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Build graph with multiple rules, where "RuleA" and "RuleB" have different dependency topologies | |
| 2 | Call analyzeBatch(["RuleA", "RuleB"], graph) | Map with 2 entries |
| 3 | Check batch contains both rules | entry for RuleA and RuleB |
| 4 | Each entry has valid scope, risk, dependents | Valid ImpactAnalysis objects |
| 5 | Call toDot(graph) | String starting with "digraph PegaDependencies {" |
| 6 | Check DOT contains node declarations | Includes "label=" syntax for node names |
| 7 | Check DOT contains edge declarations | Includes "->" syntax for edges |
| 8 | Check DOT contains rankdir=LR | Layout direction set |

**Test Data:** Multi-rule graph
**Postconditions:** Batch analysis returns all results, DOT export valid
