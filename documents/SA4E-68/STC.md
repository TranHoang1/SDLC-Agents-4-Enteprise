# Software Test Cases (STC)

## SDLC Agents 4 Enterprise — SA4E-68: Quality & Verification Tools for Pega Parser

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-68 |
| Title | Quality & Verification — Golden Dataset, Round-Trip Validator, Mutation Tester, Schema Inference, Understanding Service, Artifact Analyzer |
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
| 1.0 | 2026-07-27 | QA Agent | Initiate document — 20 test cases covering quality, inference, understanding, artifact analyzer |

---

## Test Case Summary

| Category | ID Range | Count | Priority |
|----------|----------|-------|----------|
| Golden Dataset — Sample Verification | TC-GD-01 to TC-GD-15 | 15 | High |
| Round-Trip — Field Preservation | TC-RT-01 to TC-RT-09 | 9 | High |
| Mutation — Strategy & Detection | TC-MT-01 to TC-MT-16 | 16 | High |
| Schema Inference | TC-INF-01 to TC-INF-10 | 10 | High |
| Understanding Service | TC-US-01 to TC-US-05 | 5 | High |
| Artifact Analyzer | TC-AA-01 to TC-AA-12 | 12 | High |
| **Total** | | **199** | |

---

## 1. Golden Dataset Tests

### TC-GD-01: Activity sample verification

| Field | Value |
|-------|-------|
| **ID** | TC-GD-01 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | BRD BR-01, FSD §4.1 |
| **Preconditions** | PegaGoldenDataset and PegaRuleAstParser available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Get Activity sample from PegaGoldenDataset.getActivitySample() | Sample with name "ResolveTicket", pxObjClass "Rule-Obj-Activity" |
| 2 | Parse sample.json with PegaRuleAstParser.parse() | PegaRuleAst returned |
| 3 | Call PegaGoldenDataset.verify(sample, ast) | VerificationResult with passed=true |
| 4 | Check ast.ruleType | "Rule-Obj-Activity" |
| 5 | Check ast.name | "ResolveTicket" |
| 6 | Check ast.children.length | 4 |
| 7 | Check ast.references contains expected names | Contains "ValidateData", "SendNotification", "EscalateIfNeeded", "NeedsEscalation" |

**Test Data:** Activity sample from PegaGoldenDataset.getActivitySample()
**Postconditions:** All 15 golden samples verified without issues

---

### TC-GD-02: Data Transform sample verification

| Field | Value |
|-------|-------|
| **ID** | TC-GD-02 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | BRD BR-01 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Get DataTransform sample from PegaGoldenDataset.getDataTransformSample() | Sample with name "InitializeTicket" |
| 2 | Parse and verify | VerificationResult passed=true |
| 3 | Check ast.ruleType | "Rule-Obj-Model" |
| 4 | Check expected references | Contains "SetDefaultStatus", "IsHighPriority" |

**Test Data:** DataTransform sample
**Postconditions:** References and children match expected

---

### TC-GD-03: Flow sample with shape children

| Field | Value |
|-------|-------|
| **ID** | TC-GD-03 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | BRD BR-01 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Get Flow sample | Name "MainProcess", pxObjClass "Rule-Obj-Flow" |
| 2 | Parse and verify | Passed=true |
| 3 | Check ast.children.length | 5 |
| 4 | Check references | Contains "NewAssignment", "ValidateAction", "NeedsValidation", "PaymentAction", "Work-Cover-Payment" |

**Test Data:** Flow sample with 5 shapes
**Postconditions:** Flow shapes parsed as AST children

---

### TC-GD-04: Decision table and tree samples

| Field | Value |
|-------|-------|
| **ID** | TC-GD-04 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | BRD BR-01 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Get DecisionTable sample | Name "PriorityDecision", pxObjClass "Rule-Declare-DecisionTable" |
| 2 | Parse and verify | Passed=true, children.length=4 |
| 3 | Get DecisionTree sample | Name "ApprovalTree", pxObjClass "Rule-Declare-DecisionTree" |
| 4 | Parse and verify | Passed=true, children.length=3 |

**Test Data:** DecisionTable and DecisionTree samples
**Postconditions:** Decision rows and tree nodes parsed correctly

---

### TC-GD-05: When rule with expression

| Field | Value |
|-------|-------|
| **ID** | TC-GD-05 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | BRD BR-01 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Get When sample | Name "IsHighPriority", pxObjClass "Rule-Obj-When" |
| 2 | Parse and verify | Passed=true |
| 3 | Check children.length | 0 (When rules have no child arrays) |
| 4 | Check properties.pyWhenExpression | ".pyPriority = \"Critical\" .OR. .pyUrgency > 75" |

**Test Data:** When sample with expression
**Postconditions:** Expression stored in properties

---

## 2. Round-Trip Validation Tests

### TC-RT-01: Activity round-trip preserves semantic fields

| Field | Value |
|-------|-------|
| **ID** | TC-RT-01 |
| **Priority** | High |
| **Type** | Functional — Integration |
| **Requirement** | BRD BR-02, FSD §4.2 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create PegaRoundTripValidator | Instance created |
| 2 | Get Activity sample JSON | Sample "ResolveTicket" |
| 3 | Call validate(sample.json) | RoundTripResult returned |
| 4 | Check result.success | true |
| 5 | Check result.differences.length | 0 |
| 6 | Check result.originalFields | Includes pyActivityName, steps, etc. |
| 7 | Check result.preservedFields | All semantic fields preserved |

**Test Data:** Activity sample JSON
**Postconditions:** No semantic fields lost or added

---

### TC-RT-02: Round-trip excludes system fields

| Field | Value |
|-------|-------|
| **ID** | TC-RT-02 |
| **Priority** | High |
| **Type** | Functional — Integration |
| **Requirement** | BRD BR-02 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create validator with sample containing pxCreateDateTime, pxCreateOperator | |
| 2 | Call validate() | |
| 3 | Check differences array | No px* or pz* field differences reported |
| 4 | Check lostFields includes pxCreateDateTime | Yes (but not in differences — excluded) |

**Test Data:** Activity sample with pxCreateDateTime, pxCreateOperator fields
**Postconditions:** System fields silently excluded from diff

---

### TC-RT-03: Type-specific name field mapping

| Field | Value |
|-------|-------|
| **ID** | TC-RT-03 |
| **Priority** | High |
| **Type** | Functional — Integration |
| **Requirement** | BRD BR-02 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Validate Activity sample | pyActivityName used as name field |
| 2 | Validate DataTransform sample | pyModelName used as name field |
| 3 | Validate Flow sample | pyFlowName used as name field |
| 4 | Validate When sample | pyRuleName used as name field |

**Test Data:** Activity, DataTransform, Flow, When samples
**Postconditions:** Correct name field mapped for each rule type

---

### TC-RT-04: Batch validation and property preservation

| Field | Value |
|-------|-------|
| **ID** | TC-RT-04 |
| **Priority** | High |
| **Type** | Functional — Integration |
| **Requirement** | BRD BR-02 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call validateBatch with all 15 golden sample JSONs | 15 RoundTripResults |
| 2 | Check all results.success | All true |
| 3 | For each result, call assertPropertiesPreserved(original, result) | All return true |
| 4 | Check total differences across all results | 0 semantic differences |

**Test Data:** All 15 golden sample JSONs
**Postconditions:** All rule types survive round-trip with zero semantic losses

---

## 3. Mutation Tester Tests

### TC-MT-01: Individual mutation strategies

| Field | Value |
|-------|-------|
| **ID** | TC-MT-01 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | BRD BR-03, FSD §4.3 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create PegaMutationTester | Instance created |
| 2 | Apply mutateFieldValue(activity, "pyLabel", "NewLabel") | pyLabel changed to "NewLabel" |
| 3 | Apply removeField(activity, "pyClassName") | pyClassName removed |
| 4 | Apply changeType(activity, "Rule-Obj-Flow") | pxObjClass changed to "Rule-Obj-Flow" |
| 5 | Apply addRandomField(activity) | New field pyExtraField_* added |
| 6 | Apply removeChild(activity, "steps", 1) | Second step removed |

**Test Data:** Activity sample JSON
**Postconditions:** All 5 mutation strategies produce modified objects

---

### TC-MT-02: Predefined mutation suite detects all mutations

| Field | Value |
|-------|-------|
| **ID** | TC-MT-02 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | BRD BR-03 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call runMutationSuite(sample) with activity JSON | 9 MutationTestResults |
| 2 | Check each result.detectedDifference | All 9 are true |
| 3 | Check each result.mutatedValid | Each mutation is parseable or fails gracefully |
| 4 | Check mutation names | "change-pxObjClass", "remove-pyClassName", "change-label", "add-random-field", "remove-first-step", "remove-pyActions", "set-empty-string", "set-null-value", "add-malformed-array" |

**Test Data:** Activity sample JSON
**Postconditions:** All 9 mutations produce different fingerprints

---

### TC-MT-03: Fingerprint determinism

| Field | Value |
|-------|-------|
| **ID** | TC-MT-03 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | BRD BR-03 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call fingerprint(sample) twice with same input | Both outputs identical |
| 2 | Call fingerprint(sample) with modified sample | Different output |
| 3 | Call fingerprint(sample) with empty object | "__parse_error__" |

**Test Data:** Activity sample, modified sample
**Postconditions:** Fingerprint is deterministic and sensitive to changes

---

### TC-MT-04: Mutation on non-activity rule types

| Field | Value |
|-------|-------|
| **ID** | TC-MT-04 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | BRD BR-03 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run mutation suite on DataTransform sample | 9 MutationTestResults |
| 2 | Run mutation suite on Flow sample | 9 MutationTestResults |
| 3 | Run mutation suite on Section sample | 9 MutationTestResults |
| 4 | Check all detectedDifference = true | All 27 results detect change |

**Test Data:** DataTransform, Flow, Section samples
**Postconditions:** Mutation suite works across different rule types

---

## 4. Schema Inference Tests

### TC-INF-01: Property type inference

| Field | Value |
|-------|-------|
| **ID** | TC-INF-01 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | BRD BR-04, FSD §4.4 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create PegaSchemaInferrer | Instance created |
| 2 | Infer from JSON with pyLabel="Test", pyUrgency=80, pyIsActive=true | Properties detected with correct types |
| 3 | Check pyLabel type | "string" |
| 4 | Check pyUrgency type | "number" |
| 5 | Check pyIsActive type | "boolean" |
| 6 | Check pxObjClass type | "ref" |

**Test Data:** JSON with various value types
**Postconditions:** Types correctly inferred as string, number, boolean, ref

---

### TC-INF-02: Child array inference

| Field | Value |
|-------|-------|
| **ID** | TC-INF-02 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | BRD BR-04 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Infer from JSON with steps array | Children detected |
| 2 | Check children includes {name: "steps", childType: "Embedded"} | Found |
| 3 | Infer from JSON with pyActions array | Children includes pyActions |
| 4 | Infer from JSON without arrays | Empty children array |
| 5 | Skip pxAllChangeList array | Not included in children |

**Test Data:** JSON with and without array fields
**Postconditions:** Arrays correctly identified as child collections

---

### TC-INF-03: Base class resolution 3-layer

| Field | Value |
|-------|-------|
| **ID** | TC-INF-03 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | BRD BR-04 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Infer base class for known class with registry | Known class base returned |
| 2 | Infer base class for "Rule-Obj-Activity" with registry containing "Rule-Obj-" | "Rule-Obj-" |
| 3 | Infer base class for unknown class | "@baseclass" |
| 4 | Call ensureSchema with unknown class | Schema inferred and registered |

**Test Data:** Known and unknown pxObjClass values
**Postconditions:** 3-layer resolution works: known → segment → fallback

---

## 5. Understanding Service Tests

### TC-US-01: Full understanding pipeline

| Field | Value |
|-------|-------|
| **ID** | TC-US-01 |
| **Priority** | High |
| **Type** | Functional — System |
| **Requirement** | BRD BR-07, FSD §4.8 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create PegaRuleUnderstandingService with all 7 dependencies | Instance created |
| 2 | Call understand(activityJson) | PegaRuleUnderstanding returned |
| 3 | Check understanding.pxObjClass | "Rule-Obj-Activity" |
| 4 | Check understanding.name | "ResolveTicket" |
| 5 | Check understanding.schema.classDefinition.properties | Array of PegaPropertyDef |
| 6 | Check understanding.schema.fieldDocs | Non-empty string with field descriptions |
| 7 | Check understanding.semantics.summary | Non-empty string |
| 8 | Check understanding.dependencies | Array of resolved dependencies |
| 9 | Check understanding.promptContext | Formatted string with borders |

**Test Data:** Activity sample JSON
**Postconditions:** All 7 services invoked and data populated in understanding object

---

### TC-US-02: Understanding with simulation

| Field | Value |
|-------|-------|
| **ID** | TC-US-02 |
| **Priority** | High |
| **Type** | Functional — System |
| **Requirement** | BRD BR-07 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call understand(flowJson, { simulate: true, simulateInput: {...} }) | Understanding with simulation |
| 2 | Check understanding.simulation | Non-null |
| 3 | Check understanding.simulation.input | Matches simulateInput |
| 4 | Check promptContext includes "Simulation" section | Text present |

**Test Data:** Flow sample JSON with simulate option
**Postconditions:** Simulation data included when requested

---

## 6. Artifact Analyzer Tests

### TC-AA-01: Type detection routing

| Field | Value |
|-------|-------|
| **ID** | TC-AA-01 |
| **Priority** | High |
| **Type** | Functional — System |
| **Requirement** | BRD BR-08, FSD §3.4 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create ArtifactAnalyzerRegistry | 4 default analyzers registered |
| 2 | Analyze content with pxObjClass | Detected as pega_rule, routed to PegaRuleAnalyzer |
| 3 | Analyze TypeScript source code | Detected as code, routed to GenericCodeAnalyzer |
| 4 | Analyze JSON object | Detected as structured_data, routed to StructureAnalyzer |
| 5 | Analyze plain text with no patterns | Detected as unknown, routed to FallbackAnalyzer |
| 6 | Check each result.detectedBy | "content-heuristic" or "fallback" |

**Test Data:** Pega JSON, code, JSON, XML, YAML, plain text
**Postconditions:** Each content type correctly detected and routed

---

### TC-AA-02: Hint override and fallback

| Field | Value |
|-------|-------|
| **ID** | TC-AA-02 |
| **Priority** | High |
| **Type** | Functional — System |
| **Requirement** | BRD BR-08 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Analyze plain text with hint "pega_rule" | PegaRuleAnalyzer used (even though content has no pxObjClass) |
| 2 | Analyze empty content | unknown type, FallbackAnalyzer |
| 3 | Check binary detection in FallbackAnalyzer | Binary content: true for binary-like content |
| 4 | Check MD5 hash in FallbackAnalyzer details | Non-empty hex string |

**Test Data:** Plain text with hint, empty string, binary-like content
**Postconditions:** Hint overrides auto-detection; fallback handles edge cases
