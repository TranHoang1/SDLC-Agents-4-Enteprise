# Software Test Cases (STC)

## SDLC Agents 4 Enterprise — SA4E-190: Autonomy L3 Pipeline Automation for SDLC Agents 4 Enterprise

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-190 |
| Title | Autonomy L3 Pipeline Automation for SDLC Agents 4 Enterprise |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-08-23 |
| Status | Draft |
| Related STP | STP-v1.0-SA4E-190.docx |
| Related FSD | FSD-v1.0-SA4E-190.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-23 | QA Agent | Initiate document — auto-generated from FSD use cases and business rules |

---

## Test Case Summary

| Category | ID Range | Count | Priority |
|----------|----------|-------|----------|
| Functional — Happy Path | TC-001 to TC-099 | 4 | High |
| Functional — Alternative Flows | TC-100 to TC-199 | 3 | High |
| Functional — Exception/Error Flows | TC-200 to TC-299 | 3 | High |
| Business Rule Validation | TC-300 to TC-399 | 11 | High |
| Boundary & Negative Testing | TC-400 to TC-499 | 3 | Medium |
| UI/UX Testing | TC-500 to TC-599 | 2 | Medium |
| Non-Functional (Performance, Security) | TC-600 to TC-699 | 2 | Medium |
| Integration Testing | TC-700 to TC-799 | 3 | High |
| Regression Testing | TC-800 to TC-899 | 1 | Medium |

---

## 1. Functional Test Cases — Happy Path

### TC-001: Reset Pipeline to Requirements with Autonomy L3

| Field | Value |
|-------|-------|
| **ID** | TC-001 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-01, BR-01, Story 1 AC1 |
| **Preconditions** | Ticket SA4E-190 exists, STATUS.json exists |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST /pipeline/reset with ticket=SA4E-190, autonomyLevel=L3, phase=requirements | 200 OK |
| 2 | Verify STATUS.json currentPhase=requirements | Phase set correctly |
| 3 | Verify STATUS.json autonomyLevel=L3 | Autonomy level set correctly |

**Test Data:** testdata/create-pipeline-testdata.csv TC-001
**Postconditions:** STATUS.json updated, lastUpdated timestamp set

---

### TC-002: Generate BRD from Ticket

| Field | Value |
|-------|-------|
| **ID** | TC-002 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-02, BR-05, Story 2 AC1 |
| **Preconditions** | Pipeline in requirements phase, BRD template exists |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST /brd/generate with ticketKey=SA4E-190 | 200 OK |
| 2 | Verify documents/SA4E-190/BRD.md exists | File created |
| 3 | Verify BRD contains sections: Purpose, Scope, User Stories | Sections present |

**Test Data:** testdata/brd-generation-testdata.csv TC-002
**Postconditions:** BRD.md created and ingested to Knowledge Base

---

### TC-003: Configure Autonomy Level

| Field | Value |
|-------|-------|
| **ID** | TC-003 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-03, BR-08, Story 3 AC1 |
| **Preconditions** | STATUS.json accessible |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Update autonomyLevel to L3 in STATUS.json | Update succeeds |
| 2 | Verify STATUS.json autonomyLevel=L3 | Value persisted |

**Test Data:** testdata/status-update-testdata.csv TC-003
**Postconditions:** Autonomy level configured

---

### TC-004: Review Generated Artifacts and Approve Requirements

| Field | Value |
|-------|-------|
| **ID** | TC-004 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-04, BR-10, BR-11, Story 4 AC1-3 |
| **Preconditions** | BRD.md and diagrams generated |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify business-flow.drawio exists | File exists |
| 2 | Verify business-flow.png exists | PNG exported |
| 3 | Update STATUS.json requirements status to done with completedAt | Status updated |

**Test Data:** testdata/diagram-testdata.csv TC-004
**Postconditions:** Requirements approved, completedAt set

---

## 2. Functional Test Cases — Alternative Flows

### TC-101: Reset Pipeline with Invalid Autonomy Level

| Field | Value |
|-------|-------|
| **ID** | TC-101 |
| **Priority** | High |
| **Type** | Functional — Alternative Flow |
| **Requirement** | UC-01 AF-1, BR-01 |
| **Preconditions** | Pipeline accessible |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST /pipeline/reset with autonomyLevel=L4 | 400 Bad Request |
| 2 | Verify error message: Autonomy level must be L1/L2/L3 | Correct error |

**Test Data:** testdata/create-pipeline-testdata.csv TC-101
**Postconditions:** STATUS.json unchanged

---

### TC-102: BRD Generation with Missing Template Fallback

| Field | Value |
|-------|-------|
| **ID** | TC-102 |
| **Priority** | High |
| **Type** | Functional — Alternative Flow |
| **Requirement** | UC-02 AF-1 |
| **Preconditions** | Template path missing |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST /brd/generate with missing template | Warning logged |
| 2 | Verify BRD generated using default template | BRD created |

**Test Data:** testdata/brd-generation-testdata.csv TC-102
**Postconditions:** BRD created with default template

---

### TC-103: Stakeholder Rejects Requirements

| Field | Value |
|-------|-------|
| **ID** | TC-103 |
| **Priority** | Medium |
| **Type** | Functional — Alternative Flow |
| **Requirement** | UC-04 AF-1 |
| **Preconditions** | BRD and diagrams reviewed |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Stakeholder rejects requirements | Status remains pending |
| 2 | BA Agent notified for revision | Revision workflow triggered |

**Test Data:** N/A
**Postconditions:** Requirements not marked done

---

## 3. Functional Test Cases — Exception/Error Flows

### TC-201: Reset Pipeline with Missing Ticket

| Field | Value |
|-------|-------|
| **ID** | TC-201 |
| **Priority** | High |
| **Type** | Functional — Exception Flow |
| **Requirement** | UC-01 EF-1 |
| **Preconditions** | None |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST /pipeline/reset with invalid ticket | 400 Bad Request |
| 2 | Verify error: Ticket not found | Correct error |

**Test Data:** testdata/create-pipeline-testdata.csv TC-201
**Postconditions:** No changes to STATUS.json

---

### TC-202: BRD Generation Write Failure

| Field | Value |
|-------|-------|
| **ID** | TC-202 |
| **Priority** | High |
| **Type** | Functional — Exception Flow |
| **Requirement** | UC-02 EF-1 |
| **Preconditions** | Filesystem read-only |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Attempt BRD generation with write failure | Error logged |
| 2 | Verify operator notified | Notification sent |

**Test Data:** testdata/brd-generation-testdata.csv TC-202
**Postconditions:** System stable

---

### TC-203: Diagram Export Failure

| Field | Value |
|-------|-------|
| **ID** | TC-203 |
| **Priority** | Medium |
| **Type** | Functional — Exception Flow |
| **Requirement** | BR-10 |
| **Preconditions** | Draw.io CLI unavailable |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger diagram export | Export fails |
| 2 | Verify fallback to manual export | Manual export triggered |

**Test Data:** testdata/diagram-testdata.csv TC-203
**Postconditions:** No PNG generated, warning logged

---

## 4. Business Rule Validation

### TC-301: BR-01 Autonomy Level Enum Validation

| Field | Value |
|-------|-------|
| **ID** | TC-301 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-01 |
| **Preconditions** | None |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set autonomyLevel to L1/L2/L3 | Accepted |
| 2 | Set autonomyLevel to L4 | Rejected |

**Test Data:** testdata/status-update-testdata.csv TC-301

---

### TC-302: BR-02 Current Phase Valid

| Field | Value |
|-------|-------|
| **ID** | TC-302 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-02 |
| **Preconditions** | None |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set currentPhase to requirements/specification/design | Accepted |
| 2 | Set currentPhase to invalid | Rejected |

**Test Data:** testdata/status-update-testdata.csv TC-302

---

### TC-303: BR-03 CompletedAt ISO 8601 Format

| Field | Value |
|-------|-------|
| **ID** | TC-303 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-03 |
| **Preconditions** | Requirements approved |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set completedAt to 2026-08-23T12:00:00Z | Accepted |
| 2 | Verify format matches ISO 8601 | Valid |

**Test Data:** testdata/status-update-testdata.csv TC-303

---

### TC-304: BR-04 L3 Requires Human Approval

| Field | Value |
|-------|-------|
| **ID** | TC-304 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-04 |
| **Preconditions** | AutonomyLevel=L3 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Attempt phase transition without approval | Blocked |
| 2 | Verify approval gate enforced | Gate active |

**Test Data:** testdata/status-update-testdata.csv TC-304

---

### TC-305: BR-05 BRD Follows Template

| Field | Value |
|-------|-------|
| **ID** | TC-305 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-05 |
| **Preconditions** | BRD generated |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Compare BRD.md structure to template | Matches |

**Test Data:** testdata/brd-generation-testdata.csv TC-305

---

### TC-306: BR-06 BRD Contains ≥3 User Stories

| Field | Value |
|-------|-------|
| **ID** | TC-306 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-06 |
| **Preconditions** | BRD generated |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Count user stories in BRD | ≥3 |

**Test Data:** testdata/brd-generation-testdata.csv TC-306

---

### TC-307: BR-07 No Placeholders Left

| Field | Value |
|-------|-------|
| **ID** | TC-307 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-07 |
| **Preconditions** | BRD generated |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Search BRD.md for `{...}` | None found |

**Test Data:** testdata/brd-generation-testdata.csv TC-307

---

### TC-308: BR-08 Autonomy Level Limited to L1/L2/L3

| Field | Value |
|-------|-------|
| **ID** | TC-308 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-08 |
| **Preconditions** | None |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Attempt set autonomy to invalid value | Rejected |

**Test Data:** testdata/status-update-testdata.csv TC-308

---

### TC-309: BR-09 L3 Enforces Human Review

| Field | Value |
|-------|-------|
| **ID** | TC-309 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-09 |
| **Preconditions** | Autonomy L3 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify review step required before phase transition | Enforced |

**Test Data:** testdata/status-update-testdata.csv TC-309

---

### TC-310: BR-10 Diagrams Exist as .drawio and .png

| Field | Value |
|-------|-------|
| **ID** | TC-310 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-10 |
| **Preconditions** | Diagrams generated |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Check business-flow.drawio exists | Exists |
| 2 | Check business-flow.png exists | Exists |

**Test Data:** testdata/diagram-testdata.csv TC-310

---

### TC-311: BR-11 STATUS Updated to Done After Approval

| Field | Value |
|-------|-------|
| **ID** | TC-311 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-11 |
| **Preconditions** | Requirements approved |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify STATUS.json requirements status = done | Done |
| 2 | Verify completedAt set | Timestamp present |

**Test Data:** testdata/diagram-testdata.csv TC-311

---

## 5. Boundary & Negative Testing

### TC-401: Ticket Key Regex Invalid

| Field | Value |
|-------|-------|
| **ID** | TC-401 |
| **Priority** | Medium |
| **Type** | Boundary / Negative |
| **Requirement** | Data validation |
| **Preconditions** | None |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST with ticket=invalid-key | 400 Bad Request |
| 2 | Verify error message | Validation error |

**Test Data:** testdata/create-pipeline-testdata.csv TC-401

---

### TC-402: Autonomy Level Boundary Values

| Field | Value |
|-------|-------|
| **ID** | TC-402 |
| **Priority** | Medium |
| **Type** | Boundary / Negative |
| **Requirement** | BR-01 |
| **Preconditions** | None |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set autonomy to L1, L2, L3 | Accepted |
| 2 | Set autonomy to empty | Rejected |

**Test Data:** testdata/create-pipeline-testdata.csv TC-402

---

### TC-403: Empty Ticket Key

| Field | Value |
|-------|-------|
| **ID** | TC-403 |
| **Priority** | Medium |
| **Type** | Boundary / Negative |
| **Requirement** | Data validation |
| **Preconditions** | None |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST with empty ticket | 400 Bad Request |

**Test Data:** N/A

---

## 6. UI/UX Testing

### TC-501: Diagrams Viewable as PNG

| Field | Value |
|-------|-------|
| **ID** | TC-501 |
| **Priority** | Medium |
| **Type** | UI/UX |
| **Requirement** | Story 4 AC2 |
| **Preconditions** | PNG exported |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open business-flow.png in browser | Image displays correctly |
| 2 | Verify orthogonal routing | Layout correct |

**Test Data:** testdata/diagram-testdata.csv TC-501

---

### TC-502: BRD Contains Required Headings

| Field | Value |
|-------|-------|
| **ID** | TC-502 |
| **Priority** | Medium |
| **Type** | UI/UX |
| **Requirement** | Story 2 AC1 |
| **Preconditions** | BRD generated |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open BRD.md | Headings present |
| 2 | Verify Purpose, Scope, User Stories | All present |

**Test Data:** N/A

---

## 7. Non-Functional Testing

### TC-601: BRD Generation Performance

| Field | Value |
|-------|-------|
| **ID** | TC-601 |
| **Priority** | Medium |
| **Type** | Non-Functional — Performance |
| **Requirement** | NFR Performance |
| **Preconditions** | Service running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Measure BRD generation time | < 60 seconds |

**Test Data:** N/A

---

### TC-602: Pipeline Reset Performance

| Field | Value |
|-------|-------|
| **ID** | TC-602 |
| **Priority** | Medium |
| **Type** | Non-Functional — Performance |
| **Requirement** | NFR Performance |
| **Preconditions** | Service running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Measure reset time | < 2 seconds |

**Test Data:** N/A

---

## 8. Integration Testing

### TC-701: Jira Ticket Fetch Integration

| Field | Value |
|-------|-------|
| **ID** | TC-701 |
| **Priority** | High |
| **Type** | Integration |
| **Requirement** | FSD 5.1 |
| **Preconditions** | Jira API mock available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Generate BRD with ticket | Ticket data fetched |
| 2 | Verify summary populated | Data integrated |

**Test Data:** N/A

---

### TC-702: Knowledge Base Ingestion

| Field | Value |
|-------|-------|
| **ID** | TC-702 |
| **Priority** | High |
| **Type** | Integration |
| **Requirement** | FSD 5.2 |
| **Preconditions** | KB available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Generate BRD | BRD ingested to KB |
| 2 | Verify KB search finds BRD | Artifacts accessible |

**Test Data:** N/A

---

### TC-703: Draw.io CLI Export

| Field | Value |
|-------|-------|
| **ID** | TC-703 |
| **Priority** | High |
| **Type** | Integration |
| **Requirement** | FSD 5.3 |
| **Preconditions** | Draw.io CLI installed |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Export .drawio to PNG | PNG created |
| 2 | Verify PNG valid | Image readable |

**Test Data:** N/A

---

## 9. Regression Testing

### TC-801: STATUS.json Schema Unchanged

| Field | Value |
|-------|-------|
| **ID** | TC-801 |
| **Priority** | Medium |
| **Type** | Regression |
| **Requirement** | Existing pipeline |
| **Preconditions** | Previous version available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Compare STATUS.json schema | No breaking changes |

**Test Data:** N/A

---

## 10. Requirements Traceability Matrix (RTM)

| Requirement | Source | Test Cases | Status |
|-------------|--------|------------|--------|
| Story 1 AC1 | BRD 2.3 | TC-001, TC-301, TC-302 | Covered |
| Story 1 AC2 | BRD 2.3 | TC-001, TC-303 | Covered |
| Story 1 AC3 | BRD 2.3 | TC-304, TC-309 | Covered |
| Story 2 AC1 | BRD 2.3 | TC-002, TC-305, TC-502 | Covered |
| Story 2 AC2 | BRD 2.3 | TC-002, TC-306 | Covered |
| Story 2 AC3 | BRD 2.3 | TC-002, TC-305 | Covered |
| Story 2 AC4 | BRD 2.3 | TC-002, TC-305 | Covered |
| Story 3 AC1 | BRD 2.3 | TC-003, TC-308 | Covered |
| Story 3 AC2 | BRD 2.3 | TC-304, TC-309 | Covered |
| Story 4 AC1 | BRD 2.3 | TC-004, TC-310 | Covered |
| Story 4 AC2 | BRD 2.3 | TC-004, TC-501 | Covered |
| Story 4 AC3 | BRD 2.3 | TC-004, TC-311 | Covered |
| UC-01 | FSD 3.1 | TC-001, TC-101, TC-201, TC-301..304 | Covered |
| UC-02 | FSD 3.2 | TC-002, TC-102, TC-202, TC-305..307 | Covered |
| UC-03 | FSD 3.3 | TC-003, TC-308, TC-309 | Covered |
| UC-04 | FSD 3.4 | TC-004, TC-103, TC-310, TC-311 | Covered |
| BR-01..BR-11 | FSD 3.x.3 | TC-301..TC-311 | Covered |
| NFR Performance | FSD 8 | TC-601, TC-602 | Covered |

**Coverage Summary:**

| Category | Total | Covered | Coverage % |
|----------|-------|---------|------------|
| Use Cases | 4 | 4 | 100% |
| Business Rules | 11 | 11 | 100% |
| Acceptance Criteria | 12 | 12 | 100% |
| Error Codes | 3 | 3 | 100% |
| **Overall** | **30** | **30** | **100%** |

---

## 11. Appendix

### Test Data Setup Scripts

CSV files located at `documents/SA4E-190/testdata/`:
- pre-seeded-data.csv
- create-pipeline-testdata.csv
- brd-generation-testdata.csv
- status-update-testdata.csv
- diagram-testdata.csv

### Environment Configuration

Service running at http://localhost:3000
SQLite database file: `sa4e-190.db`
Draw.io CLI: C:\Program Files\draw.io\draw.io.exe
