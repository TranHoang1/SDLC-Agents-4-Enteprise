# Software Test Cases (STC)

## SDLC Agents 4 Enterprise — SA4E-66: Pega Rule Type Coverage — 7 Parser Modules

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-66 |
| Title | Pega Rule Type Coverage — 7 Parser Modules |
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
| 1.0 | 2026-07-27 | QA Agent | Initiate document — 25 test cases covering all 7 parser modules and edge cases |

---

## Test Case Summary

| Category | ID Range | Count | Priority |
|----------|----------|-------|----------|
| Connect Parser | TC-CON-01 to TC-CON-03 | 3 | High |
| Declare Parser | TC-DEC-01 to TC-DEC-04 | 4 | High |
| Access Parser | TC-ACC-01 to TC-ACC-03 | 3 | High |
| Portal Parser | TC-PRT-01 to TC-PRT-03 | 3 | High |
| Decisioning Parser | TC-DCN-01 to TC-DCN-03 | 3 | High |
| Misc Parser | TC-MSC-01 to TC-MSC-03 | 3 | High |
| Edge Cases + Fallback | TC-EDG-01 to TC-EDG-03 | 3 | Critical |
| **Total** | | **22** | |

---

## 1. Connect Parser Tests

### TC-CON-01: REST connect rule parsing

| Field | Value |
|-------|-------|
| **ID** | TC-CON-01 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | FSD §4, BR-01 |
| **Preconditions** | PegaConnectParser class available with REST strategy |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse REST connect JSON with endpoint URL, HTTP method, auth profile, headers | ConnectRuleAST with restType |
| 2 | Verify pyEndpointURL extracted | "https://api.example.com/orders" |
| 3 | Verify pyHTTPMethod extracted | "POST" |
| 4 | Verify auth profile parsed | AuthProfile with type "oauth2" |

**Test Data:** REST connect rule JSON with full configuration
**Postconditions:** AST contains all REST-specific fields

---

### TC-CON-02: SOAP connect rule parsing

| Field | Value |
|-------|-------|
| **ID** | TC-CON-02 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | FSD §4, BR-01 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse SOAP connect JSON with WSDL URL, SOAP action, namespace | SoapConnectRuleAST |
| 2 | Verify pyWSDLURL extracted | "http://example.com/service?wsdl" |
| 3 | Verify pySOAPAction extracted | "GetOrderStatus" |

**Test Data:** SOAP connect rule JSON
**Postconditions:** AST contains SOAP-specific fields

---

### TC-CON-03: SQL connect rule parsing

| Field | Value |
|-------|-------|
| **ID** | TC-CON-03 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | FSD §4, BR-01 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse SQL connect JSON with statement, data source, connection string | SqlConnectRuleAST |
| 2 | Verify pySQLStatement extracted | "SELECT * FROM Orders WHERE Status = ?" |
| 3 | Verify pyDataSource extracted | "OrderSystemDS" |

**Test Data:** SQL connect rule JSON
**Postconditions:** AST contains SQL-specific fields



---

## 2. Declare Parser Tests

### TC-DEC-01: Declare Expression rule parsing

| Field | Value |
|-------|-------|
| **ID** | TC-DEC-01 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | FSD §4, BR-02 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse DeclareExpression JSON with expression string | DeclareExpressionRuleAST |
| 2 | Verify pyExpression extracted | ".Customer.TotalAmount * .TaxRate" |
| 3 | Verify pyTargetProperty extracted | ".Customer.TotalWithTax" |

**Test Data:** DeclareExpression rule JSON
**Postconditions:** AST contains expression and target property

---

### TC-DEC-02: Declare OnChange rule parsing

| Field | Value |
|-------|-------|
| **ID** | TC-DEC-02 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | FSD §4, BR-02 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse DeclareOnChange JSON with watch properties | DeclareOnChangeRuleAST |
| 2 | Verify watched properties extracted | [".Status", ".Amount"] |
| 3 | Verify action activity extracted | "NotifyManager" |

**Test Data:** DeclareOnChange rule JSON
**Postconditions:** AST contains watch list and action

---

### TC-DEC-03: Declare Pages rule parsing

| Field | Value |
|-------|-------|
| **ID** | TC-DEC-03 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | FSD §4, BR-02 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse DeclarePages JSON with page definitions | DeclarePagesRuleAST |
| 2 | Verify page names extracted | ["pyWorkPage", "pyWorkCover"] |
| 3 | Verify page classes extracted | ["TGB-HRApps-Work-Candidate", "TGB-HRApps-Work-Application"] |

**Test Data:** DeclarePages rule JSON with multiple page definitions
**Postconditions:** AST contains all page definitions

---

### TC-DEC-04: DecisionTable rule parsing via Declare module

| Field | Value |
|-------|-------|
| **ID** | TC-DEC-04 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | FSD §4, BR-02 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse DecisionTable JSON with conditions and results | DecisionTableRuleAST |
| 2 | Verify rows extracted | Array of 3 condition-result pairs |
| 3 | Verify result property extracted | "Discount" |

**Test Data:** DecisionTable rule JSON with 3 rows
**Postconditions:** AST contains all rows with conditions and results

---

## 3. Access Parser Tests

### TC-ACC-01: AccessGroup rule parsing

| Field | Value |
|-------|-------|
| **ID** | TC-ACC-01 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | FSD §4, BR-03 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse AccessGroup JSON with roles list | AccessGroupRuleAST |
| 2 | Verify pyAccessGroupName extracted | "HRManagers" |
| 3 | Verify pyAccessRoles extracted | ["Admin", "Manager", "ReadOnly"] |

**Test Data:** AccessGroup rule JSON with 3 roles
**Postconditions:** AST contains group name and role list

---

### TC-ACC-02: OperatorID rule parsing

| Field | Value |
|-------|-------|
| **ID** | TC-ACC-02 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | FSD §4, BR-03 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse OperatorID JSON with operator profile | OperatorIDRuleAST |
| 2 | Verify pyOperatorID extracted | "john.doe" |
| 3 | Verify pyOrganization extracted | "HR-Department" |
| 4 | Verify pyOrgUnit extracted | "Recruitment" |

**Test Data:** OperatorID rule JSON with full profile
**Postconditions:** AST contains operator identity and org info

---

### TC-ACC-03: AccessRole with privilege hierarchy

| Field | Value |
|-------|-------|
| **ID** | TC-ACC-03 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | FSD §4, BR-03 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse AccessRole JSON with privileges | AccessRoleRuleAST |
| 2 | Verify pyPrivileges extracted | ["pxView", "pxUpdate", "pxDelete"] |
| 3 | Verify pyInheritedRoles extracted | ["BaseRole", "DefaultRole"] |

**Test Data:** AccessRole rule JSON with privileges and inheritance
**Postconditions:** AST contains privilege list and inheritance chain

---

## 4. Portal Parser Tests

### TC-PRT-01: Section rule parsing

| Field | Value |
|-------|-------|
| **ID** | TC-PRT-01 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | FSD §4, BR-04 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse Section JSON with dynamic layout | SectionRuleAST |
| 2 | Verify pyLayoutType extracted | "DynamicLayout" |
| 3 | Verify pyColumns extracted | 2 |
| 4 | Verify pyFields array parsed | Array of 4 field definitions |

**Test Data:** Section rule JSON with 2-column dynamic layout, 4 fields
**Postconditions:** AST contains layout structure and fields

---

### TC-PRT-02: Harness rule parsing

| Field | Value |
|-------|-------|
| **ID** | TC-PRT-02 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | FSD §4, BR-04 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse Harness JSON with header/content/footer | HarnessRuleAST |
| 2 | Verify pyHeaderSection extracted | "HeaderSection" |
| 3 | Verify pyContentSection extracted | "CandidateDetails" |
| 4 | Verify pyFooterSection extracted | "FooterActions" |

**Test Data:** Harness rule JSON with 3 section references
**Postconditions:** AST contains all section references

---

### TC-PRT-03: Skin and Navigation rule parsing

| Field | Value |
|-------|-------|
| **ID** | TC-PRT-03 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | FSD §4, BR-04 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse Skin JSON with CSS properties | SkinRuleAST |
| 2 | Verify pyTheme extracted | "CorporateBlue" |
| 3 | Parse Navigation JSON with menu items | NavigationRuleAST |
| 4 | Verify pyMenuItems extracted | 5 items in menu tree |

**Test Data:** Skin + Navigation rule JSONs
**Postconditions:** ASTs contain styling and navigation structure

---

## 5. Decisioning Parser Tests

### TC-DCN-01: Strategy rule parsing

| Field | Value |
|-------|-------|
| **ID** | TC-DCN-01 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | FSD §4, BR-05 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse Strategy JSON with component tree | StrategyRuleAST |
| 2 | Verify pyStrategyType extracted | "Adaptive" |
| 3 | Verify pyComponents extracted | Array of 4 strategy components |
| 4 | Verify component hierarchy preserved | Tree structure with parent-child relationships |

**Test Data:** Strategy rule JSON with 4 components
**Postconditions:** AST contains strategy component tree

---

### TC-DCN-02: NBA (Next-Best-Action) rule parsing

| Field | Value |
|-------|-------|
| **ID** | TC-DCN-02 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | FSD §4, BR-05 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse NBA JSON with eligibility and ranking | NbaRuleAST |
| 2 | Verify pyNBAName extracted | "HomeLoanOffer" |
| 3 | Verify pyEligibility rule extracted | "Eligibility.HomeLoan" |
| 4 | Verify pyRanking expression extracted | ".CreditScore * .IncomeMultiplier" |

**Test Data:** NBA rule JSON with eligibility and ranking config
**Postconditions:** AST contains NBA configuration

---

### TC-DCN-03: Offer and Proposition rule parsing

| Field | Value |
|-------|-------|
| **ID** | TC-DCN-03 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | FSD §4, BR-05 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse Offer JSON with text and dates | OfferRuleAST |
| 2 | Verify pyOfferText extracted | "0% APR for 12 months" |
| 3 | Parse Proposition JSON with filter | PropositionRuleAST |
| 4 | Verify pyFilter expression extracted | ".CustomerSegment = 'Premium'" |

**Test Data:** Offer + Proposition rule JSONs
**Postconditions:** ASTs contain offer details and proposition filters

---

## 6. Misc Parser Tests

### TC-MSC-01: CaseType rule parsing

| Field | Value |
|-------|-------|
| **ID** | TC-MSC-01 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | FSD §4, BR-06 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse CaseType JSON with stages and start shape | CaseTypeRuleAST |
| 2 | Verify pyCaseTypeName extracted | "CandidateOnboarding" |
| 3 | Verify pyStages extracted | Array of 4 stage definitions |
| 4 | Verify pyStartShape extracted | "StartProcess" |

**Test Data:** CaseType rule JSON with 4 stages
**Postconditions:** AST contains case lifecycle structure

---

### TC-MSC-02: Report Definition rule parsing

| Field | Value |
|-------|-------|
| **ID** | TC-MSC-02 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | FSD §4, BR-06 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse ReportDef JSON with data source and columns | ReportDefRuleAST |
| 2 | Verify pyReportName extracted | "OpenCandidatesByStatus" |
| 3 | Verify pyDataSource extracted | "TGB-HRApps-Work-Candidate" |
| 4 | Verify pyColumns extracted | Array of 5 column definitions |

**Test Data:** ReportDef rule JSON with 5 columns
**Postconditions:** AST contains report structure

---

### TC-MSC-03: Utility and Agent rule parsing

| Field | Value |
|-------|-------|
| **ID** | TC-MSC-03 |
| **Priority** | High |
| **Type** | Functional — Unit |
| **Requirement** | FSD §4, BR-06 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse Utility JSON with activity reference | UtilityRuleAST |
| 2 | Verify pyActivity extracted | "SendNotification" |
| 3 | Parse Agent JSON with schedule and query | AgentRuleAST |
| 4 | Verify pySchedule extracted | "0 0 * * *" (daily) |

**Test Data:** Utility + Agent rule JSONs
**Postconditions:** ASTs contain utility and agent configuration

---

## 7. Edge Cases + Fallback Tests

### TC-EDG-01: Empty rule JSON parsing

| Field | Value |
|-------|-------|
| **ID** | TC-EDG-01 |
| **Priority** | Critical |
| **Type** | Edge Case — Exception Flow |
| **Requirement** | BR-07 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse empty JSON `{}` with DefaultPegaParserStrategy | Returns ParseResult with minimal symbol data |

**Test Data:** Empty JSON `{}`
**Postconditions:** Valid ParseResult returned without error

---

### TC-EDG-02: Missing optional fields in rule JSON

| Field | Value |
|-------|-------|
| **ID** | TC-EDG-02 |
| **Priority** | Critical |
| **Type** | Edge Case |
| **Requirement** | BR-01 through BR-07 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse REST connect JSON without headers field | AST created with empty headers array |
| 2 | Parse DeclareExpression without expression | Error: missing required field pyExpression |
| 3 | Parse Section JSON without fields array | AST created with empty fields array |

**Test Data:** Rule JSONs with missing optional fields
**Postconditions:** Parser handles gracefully with defaults or reports specific missing fields

---

### TC-EDG-03: Unrecognized rule type

| Field | Value |
|-------|-------|
| **ID** | TC-EDG-03 |
| **Priority** | Critical |
| **Type** | Edge Case |
| **Requirement** | BR-07 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Resolve unrecognized pxObjClass "Rule-Zoo-Unicorn" | DefaultPegaParserStrategy selected |
| 2 | Parse unrecognized type via DefaultPegaParserStrategy | ParseResult with generic symbol data |

**Test Data:** pxObjClass with no registered parser
**Postconditions:** Default fallback produces valid ParseResult
