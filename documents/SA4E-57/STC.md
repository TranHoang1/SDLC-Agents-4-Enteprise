# Software Test Cases (STC)

## SDLC Agents 4 Enterprise — SA4E-57: Pega Parser L3-L4 Semantic Understanding & Execution Engine

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-57 |
| Title | Pega Parser L3-L4: Semantic Understanding & Execution Engine |
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
| 1.0 | 2026-07-27 | QA Agent | Initiate document — 25 test cases covering expression, workflow, decision, UI, security |

---

## Test Case Summary

| Category | ID Range | Count | Priority |
|----------|----------|-------|----------|
| Expression — Lexer/Parser | TC-EXP-01 to TC-EXP-05 | 5 | High |
| Expression — Evaluator | TC-EXP-06 to TC-EXP-10 | 5 | High |
| Workflow — Engine | TC-WF-01 to TC-WF-05 | 5 | High |
| Decision — Table/Tree | TC-DT-01 to TC-DT-04 | 4 | High |
| UI — Section Renderer | TC-UI-01 to TC-UI-02 | 2 | Medium |
| Security — Sandbox | TC-SEC-01 to TC-SEC-04 | 4 | Critical |
| **Total** | | **25** | |

---

## 1. Expression — Lexer/Parser Tests

### TC-EXP-01: Simple property reference parsing

| Field | Value |
|-------|-------|
| **ID** | TC-EXP-01 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | FSD §3.1, BRD Story 1 AC-1 |
| **Preconditions** | PegaExpressionLexer and PegaExpressionParser classes available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Tokenize `.Customer.Name` | Tokens: [DOT, IDENTIFIER("Customer"), DOT, IDENTIFIER("Name")] |
| 2 | Parse token stream | ExpressionAST with nodeType "PropertyRef", path [".Customer.Name"] |
| 3 | Tokenize `@upper(.Name)` | Tokens: [FUNCTION("upper"), LPAREN, DOT, IDENTIFIER("Name"), RPAREN] |
| 4 | Parse token stream | ExpressionAST with nodeType "FunctionCall", name "upper" |

**Test Data:** `.Customer.Name`, `@upper(.Name)`, `123`, `"hello world"`, `.Order.Total`
**Postconditions:** AST nodes created with correct types

---

### TC-EXP-02: String and numeric literal parsing

| Field | Value |
|-------|-------|
| **ID** | TC-EXP-02 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | FSD §3.1 |
| **Preconditions** | Lexer and parser available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Tokenize `"hello"` | STRING("hello") |
| 2 | Tokenize `'world'` | STRING("world") |
| 3 | Tokenize `123` | NUMBER(123) |
| 4 | Tokenize `45.67` | NUMBER(45.67) |

**Test Data:** `"hello"`, `'world'`, `123`, `45.67`
**Postconditions:** Correct literal nodes created

---

### TC-EXP-03: Binary and unary operator parsing

| Field | Value |
|-------|-------|
| **ID** | TC-EXP-03 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | FSD §3.1, BRD Story 1 AC-1 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse `.Status = "Open"` | BinaryOp: left=PropertyRef(.Status), op=EQUALS, right=String("Open") |
| 2 | Parse `.Age > 18 .AND. .Status = "Active"` | BinaryOp: left=BinaryOp(.Age > 18), op=AND, right=BinaryOp(...) |
| 3 | Parse `.NOT. .IsActive` | UnaryOp: op=NOT, operand=PropertyRef(.IsActive) |
| 4 | Parse `.Amount >= 100` | BinaryOp: op=GTE |

**Test Data:** Various operator combinations
**Postconditions:** Correct operator node types

---

### TC-EXP-04: Parse error reporting

| Field | Value |
|-------|-------|
| **ID** | TC-EXP-04 |
| **Priority** | High |
| **Type** | Functional — Exception Flow |
| **Requirement** | BRD Story 1 AC-3 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse `@(` | ParseError with line 1, col 3: expected IDENTIFIER after @ |
| 2 | Parse `.123` | ParseError with line 1, col 2: expected IDENTIFIER after DOT |
| 3 | Parse `"unclosed` | ParseError: unterminated string literal |

**Test Data:** Invalid expression strings
**Postconditions:** Parser returns structured error objects

---

### TC-EXP-05: Function call with arguments

| Field | Value |
|-------|-------|
| **ID** | TC-EXP-05 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | FSD §3.1, BR-EXP-1 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse `@If(.Status = "Open", .Amount, 0)` | FunctionCall "If" with 3 args |
| 2 | Parse `@round(.Total * 1.1)` | FunctionCall "round" with 1 arg (BinaryOp *) |
| 3 | Parse `@CurrentDate()` | FunctionCall "CurrentDate" with 0 args |

**Test Data:** Function calls with 0, 1, 3 arguments
**Postconditions:** Correct argument lists in AST

---

## 2. Expression — Evaluator Tests

### TC-EXP-06: Simple property reference evaluation

| Field | Value |
|-------|-------|
| **ID** | TC-EXP-06 |
| **Priority** | High |
| **Type** | Functional — Integration |
| **Requirement** | BRD Story 1 AC-4, AC-5 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Evaluate `.Customer.Name` against clipboard with `Customer.Name = "John Doe"` | Value: "John Doe" (Text) |
| 2 | Evaluate `.Order.Total` against clipboard with `Order.Total = 1500` | Value: 1500 (Decimal) |

**Test Data:** Clipboard with Customer.Name = "John Doe", Order.Total = 1500
**Postconditions:** Correct typed values returned

---

### TC-EXP-07: Function call evaluation

| Field | Value |
|-------|-------|
| **ID** | TC-EXP-07 |
| **Priority** | High |
| **Type** | Functional — Integration |
| **Requirement** | FSD §BR-EXP-1, BRD Story 1 AC-5 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Evaluate `@upper(.Name)` with `Name = "john"` | "JOHN" |
| 2 | Evaluate `@round(45.67)` | 46 |
| 3 | Evaluate `@If(1 = 1, "yes", "no")` | "yes" |

**Test Data:** Various function calls with known inputs
**Postconditions:** Correct function results

---

### TC-EXP-08: Nested property resolution with parent references

| Field | Value |
|-------|-------|
| **ID** | TC-EXP-08 |
| **Priority** | High |
| **Type** | Functional — Integration |
| **Requirement** | BRD Story 1 AC-4 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Evaluate `.Customer.Address.City` | "New York" |
| 2 | Evaluate `pyWorkPage.Order.Total` | 1500 |

**Test Data:** Multi-level page hierarchy
**Postconditions:** Correct resolution regardless of relative/absolute path

---

### TC-EXP-09: Boolean operator evaluation (AND, OR, NOT)

| Field | Value |
|-------|-------|
| **ID** | TC-EXP-09 |
| **Priority** | High |
| **Type** | Functional — Integration |
| **Requirement** | FSD §3.1 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Evaluate `.Status = "Open" .AND. .Amount > 100` | true |
| 2 | Evaluate `.Status = "Closed" .OR. .Amount = 0` | true or false based on data |
| 3 | Evaluate `.NOT. .IsActive` | false (when IsActive = true) |

**Test Data:** Clipboard with Status="Open", Amount=150, IsActive=true
**Postconditions:** Correct boolean results

---

### TC-EXP-10: Property not found error

| Field | Value |
|-------|-------|
| **ID** | TC-EXP-10 |
| **Priority** | High |
| **Type** | Functional — Exception Flow |
| **Requirement** | FSD §BR-EXP-3 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Evaluate `.NonExistent.Property` | PropertyNotFound error |
| 2 | Evaluate `.Customer.MissingField` | PropertyNotFound error |

**Test Data:** Clipboard without the referenced properties
**Postconditions:** Structured error returned, no crash

---

## 3. Workflow — Engine Tests

### TC-WF-01: Basic flow simulation (Assign → Route → End)

| Field | Value |
|-------|-------|
| **ID** | TC-WF-01 |
| **Priority** | High |
| **Type** | Functional — System |
| **Requirement** | FSD §3.2, BRD Story 2 AC-1, AC-3, AC-5 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST /api/pega/simulate-flow with flow: Start → Assign → Route → End | |
| 2 | Verify work item state | State = "Resolved" |
| 3 | Verify history length | 4 entries: [Start, Assign, Route, End] |
| 4 | Verify completed flag | true |

**Test Data:** Flow with 4 shapes (Start, Assign, Route, End), connector conditions all true
**Postconditions:** WorkItem completed with full history

---

### TC-WF-02: Route handler condition evaluation

| Field | Value |
|-------|-------|
| **ID** | TC-WF-02 |
| **Priority** | High |
| **Type** | Functional — Integration |
| **Requirement** | BRD Story 2 AC-3 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create flow with Route shape → 2 outgoing connectors: pathA (when .Status="Open"), pathB (when .Status="Closed") | |
| 2 | Set clipboard Status="Open" | |
| 3 | Simulate flow | Route goes to pathA |
| 4 | Set clipboard Status="Closed" | |
| 5 | Simulate flow again | Route goes to pathB |

**Test Data:** Flow with conditional route, varied clipboard
**Postconditions:** Correct path selection based on condition evaluation

---

### TC-WF-03: Approval handler — accept and reject

| Field | Value |
|-------|-------|
| **ID** | TC-WF-03 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | BRD Story 2 AC-2 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create Approval shape with 2-stage chain | |
| 2 | Simulate approval with accept action | Approval advances to next stage or completes |
| 3 | Simulate approval with reject action | Approval follows reject path |

**Test Data:** Approval shape with multi-stage configuration
**Postconditions:** Approval handler processes accept/reject correctly

---

### TC-WF-04: SLA engine calculation

| Field | Value |
|-------|-------|
| **ID** | TC-WF-04 |
| **Priority** | Medium |
| **Type** | Functional — Unit |
| **Requirement** | BRD Story 2 AC-4 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create SLA shape with goalTime="4h", deadline="8h", urgency=10 | |
| 2 | Calculate SLA values | goalTime parsed to 4h in ms, deadline parsed to 8h |
| 3 | Check urgency | urgency = 10 |

**Test Data:** SLA configuration with various time formats
**Postconditions:** SLA calculations are correct

---

### TC-WF-05: No matching route path error

| Field | Value |
|-------|-------|
| **ID** | TC-WF-05 |
| **Priority** | High |
| **Type** | Functional — Exception Flow |
| **Requirement** | FSD §AF-WF-01 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create Route shape with 2 connectors, both conditions evaluate false | |
| 2 | Simulate flow | "No matching route path" error |
| 3 | Verify work item state | State = "Failed" |

**Test Data:** Route with all-false conditions
**Postconditions:** Error returned, work item marked Failed

---

## 4. Decision — Table/Tree Tests

### TC-DT-01: Decision table exact match evaluation

| Field | Value |
|-------|-------|
| **ID** | TC-DT-01 |
| **Priority** | High |
| **Type** | Functional — System |
| **Requirement** | FSD §3.3, BRD Story 3 AC-1 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST /api/pega/evaluate-decision with table: Row1 (Status="Gold", Amount>1000→Discount=15), Row2 (Status="Silver"→Discount=10) | |
| 2 | Input: Status="Gold", Amount=1500 | Matched row 1, Discount=15 |
| 3 | Input: Status="Silver" | Matched row 2, Discount=10 |

**Test Data:** Decision table with 3 rows, various inputs
**Postconditions:** First matching row wins

---

### TC-DT-02: Decision table range and set membership operators

| Field | Value |
|-------|-------|
| **ID** | TC-DT-02 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | BRD Story 3 AC-2 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Evaluate condition `.Amount >= 100 .AND. .Amount < 200` with Amount=150 | true |
| 2 | Evaluate condition `.Region IN ("East", "West")` with Region="East" | true |
| 3 | Evaluate condition `.Region NOT IN ("North", "South")` with Region="East" | true |
| 4 | Evaluate condition `.Status IS NULL` with Status=null | true |

**Test Data:** Range, IN, NOT IN, IS NULL conditions
**Postconditions:** All operator types evaluated correctly

---

### TC-DT-03: Decision tree traversal

| Field | Value |
|-------|-------|
| **ID** | TC-DT-03 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | BRD Story 3 AC-3, AC-4 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Define tree: Root (.Status="Open") → Left (.Amount>100→Result A) → Right (Result B) | |
| 2 | Input: Status="Open", Amount=200 | Result A (path: Root→Left) |
| 3 | Input: Status="Closed" | Result B (path: Root→Right) |

**Test Data:** Decision tree with 3 nodes
**Postconditions:** Correct leaf reached with trace path

---

### TC-DT-04: Decision table fallthrough — no match

| Field | Value |
|-------|-------|
| **ID** | TC-DT-04 |
| **Priority** | High |
| **Type** | Functional — Exception Flow |
| **Requirement** | BRD Story 3 AC-6 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Evaluate with input that matches no row (table has no default) | matched=false, defaultUsed=false |
| 2 | Check error | Returns NoMatchFound |
| 3 | Evaluate with input that matches no row (table has default row) | matched=true, defaultUsed=true, default result returned |

**Test Data:** Table with and without default row
**Postconditions:** Appropriate handling of unmatched inputs

---

## 5. UI — Section Renderer Tests

### TC-UI-01: Dynamic layout rendering to HTML

| Field | Value |
|-------|-------|
| **ID** | TC-UI-01 |
| **Priority** | Medium |
| **Type** | Functional — Unit / Snapshot |
| **Requirement** | FSD §3.4, BRD Story 4 AC-1, AC-4 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Render Dynamic Layout (2 columns, 4 fields) | HTML with div.pega-dynamic-layout.pega-columns-2 |
| 2 | Verify each field rendered | div.pega-field with label + value |
| 3 | Check snapshot | Matches stored snapshot |

**Test Data:** Section with Dynamic Layout, 4 fields (Name, Status, Amount, Date)
**Postconditions:** Valid HTML with correct CSS classes

---

### TC-UI-02: Tab layout and harness assembly

| Field | Value |
|-------|-------|
| **ID** | TC-UI-02 |
| **Priority** | Medium |
| **Type** | Functional — Unit / Snapshot |
| **Requirement** | BRD Story 4 AC-2, AC-4, AC-5 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Render Tab Layout with 3 tabs | div.pega-tab-layout with tab headers + content |
| 2 | Assemble harness: header + content + footer | Full harness HTML |
| 3 | Verify inline CSS | CSS classes defined in <style> block |
| 4 | Check snapshot | Matches stored snapshot |

**Test Data:** Harness with header/content/footer sections, Tab Layout
**Postconditions:** Complete HTML harness document

---

## 6. Security — Sandbox Tests

### TC-SEC-01: Expression sandbox timeout

| Field | Value |
|-------|-------|
| **ID** | TC-SEC-01 |
| **Priority** | Critical |
| **Type** | Security |
| **Requirement** | FSD §3.5, BRD Story 5 AC-1 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create expression with infinite loop (if possible) or long-running eval | |
| 2 | Set timeout to 100ms | |
| 3 | Evaluate expression through sandbox | Sandbox terminates worker, returns TIMEOUT error within 200ms |
| 4 | Verify worker is recycled | Pool creates new worker, next request succeeds |

**Test Data:** Expression designed to exceed short timeout
**Postconditions:** Worker terminated cleanly, error returned, no process crash

---

### TC-SEC-02: Function whitelist enforcement

| Field | Value |
|-------|-------|
| **ID** | TC-SEC-02 |
| **Priority** | Critical |
| **Type** | Security |
| **Requirement** | BRD Story 5 AC-2 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `@dangerous(.Value)` | FUNCTION_NOT_ALLOWED error |
| 2 | Call `@eval("process.exit()")` | FUNCTION_NOT_ALLOWED error |
| 3 | Call `@upper(.Name)` | OK — function is whitelisted |
| 4 | Call `@If(true, 1, 0)` | OK — If is whitelisted |

**Test Data:** Various whitelisted and non-whitelisted function names
**Postconditions:** Only whitelisted functions execute

---

### TC-SEC-03: Expression depth limit enforcement

| Field | Value |
|-------|-------|
| **ID** | TC-SEC-03 |
| **Priority** | Critical |
| **Type** | Security |
| **Requirement** | BRD Story 5 AC-3 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create deeply nested expression (>100 levels) | |
| 2 | Validate expression | ValidationError: exceeds max depth of 100 |
| 3 | Create expression with 50 levels | OK — within limit |

**Test Data:** Nested function calls, deeply nested binary operations
**Postconditions:** Validation rejects deep expressions, accepts shallow ones

---

### TC-SEC-04: HTML XSS prevention in UI renderer

| Field | Value |
|-------|-------|
| **ID** | TC-SEC-04 |
| **Priority** | Critical |
| **Type** | Security |
| **Requirement** | BRD Story 5 AC-5, BR-UI-2 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create field with value `<script>alert('xss')</script>` | |
| 2 | Render section | Value is HTML-escaped: `&lt;script&gt;alert('xss')&lt;/script&gt;` |
| 3 | Create field with label `"><img src=x onerror=alert(1)>` | |
| 4 | Render section | Label is HTML-escaped |
| 5 | Verify no unescaped HTML in output | Snapshot confirms all values escaped |

**Test Data:** XSS vectors in property values, labels, descriptions
**Postconditions:** No raw HTML in output; all user-facing values escaped
