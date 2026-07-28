# Software Test Cases (STC)

## SDLC Agents 4 Enterprise — SA4E-65: Pega MetaModel Engine

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-65 |
| Title | Pega MetaModel Engine — Auto-Schema Loading & Runtime Strategy Compilation |
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
| 1.0 | 2026-07-27 | QA Agent | Initiate document — 15 test cases covering loader, registry, compiler, service |

---

## Test Case Summary

| Category | ID Range | Count | Priority |
|----------|----------|-------|----------|
| Schema Loading | TC-MM-01 to TC-MM-03 | 3 | High |
| Inheritance Resolution | TC-MM-04 to TC-MM-06 | 3 | High |
| Registry | TC-MM-07 to TC-MM-08 | 2 | High |
| Strategy Compilation | TC-MM-09 to TC-MM-11 | 3 | High |
| Wildcard & Matching | TC-MM-12 to TC-MM-13 | 2 | High |
| Service & Integration | TC-MM-14 to TC-MM-15 | 2 | High |
| **Total** | | **15** | |

---

## 1. Schema Loading Tests

### TC-MM-01: Load schema directory and return non-empty registry

| Field | Value |
|-------|-------|
| **ID** | TC-MM-01 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | BR-01, FSD §3.2 |
| **Preconditions** | Schema directory exists with 239+ JSON files |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create PegaMetaModelLoader instance | Loader created |
| 2 | Call loadSchemaDirectory(schemasDir) | Returns Map with entries |
| 3 | Check registry size | size >= 20 (minimum base classes) |
| 4 | Check registry size exceeds 100 | size > 100 |

**Test Data:** Real schemas directory path
**Postconditions:** Registry populated with all valid class definitions

---

### TC-MM-02: Load specific class definition with correct metadata

| Field | Value |
|-------|-------|
| **ID** | TC-MM-02 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | BR-01, FSD §3.2 |
| **Preconditions** | Schemas loaded |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Load schema directory | Loader initialized |
| 2 | Get class Rule-Obj-Activity | Definition returned |
| 3 | Check pxObjClass | "Rule-Obj-Activity" |
| 4 | Check properties | Contains pyLabel, pyDescription, pyClassName |
| 5 | Check baseClass | "Rule-Obj-" |
| 6 | Check children | At least 1 child (pyKeyDefList) |

**Test Data:** Rule-Obj-Activity schema file
**Postconditions:** Class definition parsed with correct metadata

---

### TC-MM-03: Handle missing directory gracefully

| Field | Value |
|-------|-------|
| **ID** | TC-MM-03 |
| **Priority** | High |
| **Type** | Functional — Exception Flow |
| **Requirement** | FSD §3.2 |
| **Preconditions** | None |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call loadSchemaDirectory('/nonexistent/path') | Returns empty Map |
| 2 | Check registry size | size == 0 |
| 3 | Call loadSchemaFile('/nonexistent/file.json') | Returns null |

**Test Data:** Invalid paths
**Postconditions:** No exception thrown, graceful fallback

---

## 2. Inheritance Resolution Tests

### TC-MM-04: Resolve one-level inheritance (Rule-Obj-Activity inherits from Rule-Obj-)

| Field | Value |
|-------|-------|
| **ID** | TC-MM-04 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | BR-02, FSD §3.2 |
| **Preconditions** | Schemas loaded, inheritance resolved |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Get Rule-Obj-Activity definition | Definition resolved |
| 2 | Get Rule-Obj- definition | Base category definition |
| 3 | Collect activity property names | Set of property names |
| 4 | Verify each parent property is present | For each parent prop: activityProps has parentProp.name |

**Test Data:** Rule-Obj-Activity and Rule-Obj- schemas
**Postconditions:** All parent properties merged into child

---

### TC-MM-05: Resolve multi-level inheritance to @baseclass

| Field | Value |
|-------|-------|
| **ID** | TC-MM-05 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | BR-02, FSD §3.2, TDD §3.4 |
| **Preconditions** | Full schema loading |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Get Rule-Obj-Activity def | Resolved |
| 2 | Get @baseclass def | Root definition |
| 3 | Get Rule- def | Intermediate base |
| 4 | Get Rule-Obj- def | Intermediate base |
| 5 | Verify activity has all @baseclass properties | Each @baseclass prop name found in activity props |
| 6 | Verify activity has all Rule- properties | Each Rule- prop name found in activity props |
| 7 | Verify activity has all Rule-Obj- properties | Each Rule-Obj- prop name found in activity props |

**Test Data:** Full inheritance chain: Rule-Obj-Activity → Rule-Obj- → Rule- → @baseclass
**Postconditions:** Multi-level inheritance fully resolved

---

### TC-MM-06: Child definition merging through inheritance

| Field | Value |
|-------|-------|
| **ID** | TC-MM-06 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | BR-02, FSD §3.2 |
| **Preconditions** | Schemas loaded |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Get Rule-Obj-Activity definition | Resolved definition |
| 2 | Get @baseclass definition | Root definition |
| 3 | Check activity children include pyLinks | Child pyLinks present |
| 4 | Check activity children include pyPagesAndClasses | Child pyPagesAndClasses present |
| 5 | Check activity children include pyValidRuleSets | Child pyValidRuleSets present |
| 6 | Check @baseclass children length >= 3 | At least 3 children |

**Test Data:** Rule-Obj-Activity and @baseclass schemas
**Postconditions:** Children from base classes merged into child

---

## 3. Registry Tests

### TC-MM-07: Singleton returns same instance

| Field | Value |
|-------|-------|
| **ID** | TC-MM-07 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | FSD §3.3, TDD §4.2 |
| **Preconditions** | None |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call PegaMetaModelRegistry.getInstance() | Instance A |
| 2 | Call PegaMetaModelRegistry.getInstance() | Instance B |
| 3 | Compare instances | Instance A === Instance B (same reference) |

**Test Data:** None
**Postconditions:** Singleton pattern verified

---

### TC-MM-08: Registry class lookup and enumeration

| Field | Value |
|-------|-------|
| **ID** | TC-MM-08 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | BR-01, FSD §3.3 |
| **Preconditions** | Registry initialized with schemas |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Check isKnownClass('Rule-Obj-Activity') | true |
| 2 | Check isKnownClass('NonExistent') | false |
| 3 | Get getKnownClasses() | Contains 'Rule-Obj-Activity', '@baseclass', length > 100 |
| 4 | Get getParser('Rule-Obj-Flow') | Returns def with pxObjClass = 'Rule-Obj-Flow', label = 'Flow' |
| 5 | Get getParser('NonExistent-Class-XYZ') | undefined |

**Test Data:** Known and unknown class names
**Postconditions:** Lookup functions work correctly

---

## 4. Strategy Compilation Tests

### TC-MM-09: Compile strategy and parse sample Activity JSON

| Field | Value |
|-------|-------|
| **ID** | TC-MM-09 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | BR-03, FSD §3.4, TDD §4.3 |
| **Preconditions** | Schema loaded, Rule-Obj-Activity definition available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Compile strategy for Rule-Obj-Activity | Strategy created |
| 2 | Check supports('Rule-Obj-Activity') | true |
| 3 | Parse sample activity JSON | ParseResult returned |
| 4 | Check symbol.ruleType | "Rule-Obj-Activity" |
| 5 | Check symbol.name | "ApproveOrder" |
| 6 | Check symbol.className | "Work-Order" |
| 7 | Check symbol.fqn | "Rule-Obj-Activity:Work-Order:ApproveOrder" |
| 8 | Check symbol.isRule | true |
| 9 | Check symbol.ruleset | "OrderApp" |
| 10 | Check symbol.version | "01-02-01" |
| 11 | Check dependencies length >= 1 | At least 1 dependency detected |
| 12 | Check dependency ruleName | Contains "ApproveOrder" |

**Test Data:** Sample Activity JSON with pyMethod = "Call", pyMethodParameters = "ValidateOrder"
**Postconditions:** Strategy parses JSON into correct symbol and dependencies

---

### TC-MM-10: Compile strategy and parse sample Connect-REST JSON

| Field | Value |
|-------|-------|
| **ID** | TC-MM-10 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | BR-03, FSD §3.4 |
| **Preconditions** | Schema loaded, Rule-Connect-REST definition available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Compile strategy for Rule-Connect-REST | Strategy created |
| 2 | Check supports('Rule-Connect-REST') | true |
| 3 | Parse sample REST connect JSON | ParseResult returned |
| 4 | Check symbol.ruleType | "Rule-Connect-REST" |
| 5 | Check dependencies | Contains at least 3 references |
| 6 | Check dependency ruleName "JiraOAuth" | ruleType = "Rule-Connect-AuthProfile" |
| 7 | Check dependency ruleName "MapJiraRequest" | ruleType = "Rule-Obj-Model" |
| 8 | Check dependency ruleName "ParseJiraResponse" | ruleType = "Rule-Obj-Model" |

**Test Data:** Sample Connect-REST JSON with pyAuthProfile, pyRequestDataTransform, pyResponseDataTransform
**Postconditions:** Reference dependencies correctly detected and typed

---

### TC-MM-11: Compile strategy for DecisionTable and detect property reference

| Field | Value |
|-------|-------|
| **ID** | TC-MM-11 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | BR-03, FSD §3.4 |
| **Preconditions** | Schema loaded, Rule-Declare-DecisionTable definition available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Compile strategy for Rule-Declare-DecisionTable | Strategy created |
| 2 | Check supports('Rule-Declare-DecisionTable') | true |
| 3 | Parse sample DecisionTable JSON | ParseResult returned |
| 4 | Check symbol.ruleType | "Rule-Declare-DecisionTable" |
| 5 | Check symbol.name | "PriorityDecision" |
| 6 | Check dependencies | Contains at least 1 |
| 7 | Find dependency for "pyPriority" | ruleType = "Rule-Obj-Property" |

**Test Data:** DecisionTable JSON with pyPropertyEvaluated = "pyPriority"
**Postconditions:** pyPropertyEvaluated field detected as Rule-Obj-Property reference

---

## 5. Wildcard & Matching Tests

### TC-MM-12: @baseclass matches everything / prefix category matching

| Field | Value |
|-------|-------|
| **ID** | TC-MM-12 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | BR-03, FSD §3.4, TDD §4.3 |
| **Preconditions** | Schemas loaded, strategies compiled |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Compile strategy for Rule- | Strategy for base category |
| 2 | Check supports('Rule-Obj-Activity') | true (prefix match 'Rule-') |
| 3 | Check supports('Rule-Obj-Flow') | true |
| 4 | Check supports('Rule-Connect-REST') | true |
| 5 | Check supports('Rule-Declare-DecisionTable') | true |
| 6 | Check supports('Rule-Obj-') | true |
| 7 | Compile strategy for Rule-Connect- | Strategy for connect category |
| 8 | Check supports('Rule-Connect-REST') | true |
| 9 | Check supports('Rule-Connect-SOAP') | true |
| 10 | Check supports('Rule-Connect-SQL') | true |
| 11 | Check supports('Rule-Obj-Activity') | false (not in Rule-Connect- hierarchy) |

**Test Data:** Base categories: Rule-, Rule-Connect-
**Postconditions:** Correct prefix matching and exclusion

---

### TC-MM-13: Inheritance chain matching via isDerivedFrom

| Field | Value |
|-------|-------|
| **ID** | TC-MM-13 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | BR-02, BR-03 |
| **Preconditions** | Schemas loaded, compiler created |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Compile strategy for Rule-Obj- | Strategy created |
| 2 | Check supports('Rule-Obj-Activity') | true (via prefix match) |
| 3 | Check supports('Rule-Obj-Flow') | true |
| 4 | Check compileAll returns 175+ strategies | At least 175 |
| 5 | Verify key classes are supported by at least 1 strategy | Every key class matched |

**Test Data:** All registered classes
**Postconditions:** All classes matchable via inheritance chain

---

## 6. Service & Integration Tests

### TC-MM-14: PegaMetaModelService full initialization pipeline

| Field | Value |
|-------|-------|
| **ID** | TC-MM-14 |
| **Priority** | High |
| **Type** | Functional — Integration |
| **Requirement** | BR-04, FSD §3.5, TDD §4.4 |
| **Preconditions** | None |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create new PegaMetaModelService() | Service instance created |
| 2 | Check isInitialized() | false |
| 3 | Call initialize(schemasDir) | Completes without error |
| 4 | Check isInitialized() | true |
| 5 | Parse Activity JSON via service registry | Returns correct symbol.ruleType = "Rule-Obj-Activity" |
| 6 | Parse Connect-REST JSON via service registry | Returns correct symbol.ruleType = "Rule-Connect-REST" |
| 7 | Check Connect-REST dependencies | Contains auth profile dependency |

**Test Data:** Sample Activity and Connect-REST JSON
**Postconditions:** Full pipeline works: load → compile → register → parse

---

### TC-MM-15: Service idempotent initialization and edge cases

| Field | Value |
|-------|-------|
| **ID** | TC-MM-15 |
| **Priority** | High |
| **Type** | Functional — Integration |
| **Requirement** | FSD §3.5, TDD §4.4 |
| **Preconditions** | None |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create service, initialize | Initialized |
| 2 | Call initialize() again | No-op, still initialized |
| 3 | Parse empty JSON object {} | No exception thrown |
| 4 | Check parse result for empty object | symbol defined, name = "Unnamed" |
| 5 | Parse JSON with null/undefined values | No exception thrown |
| 6 | Parse JSON with only pxObjClass and pyRuleName | Partial result returned |
| 7 | Parse unknown class with fallback strategy | Returns result with name from pyActivityName |

**Test Data:** Empty object, null values, minimal JSON
**Postconditions:** Graceful handling of edge cases without exceptions
