# System Test Cases (STC)

## SDLC Agents 4 Enterprise — SA4E-84: [drawio] Upgrade drawio_auto_layout to FIX mode

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-84 |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-08-01 |
| Status | Draft |
| Related STP | STP-v1.0-SA4E-84.docx |
| Related BRD | BRD-v1.0-SA4E-84.docx |
| Related FSD | FSD-v0.3-SA4E-84.docx |
| Related TDD | TDD-v1.1-SA4E-84.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-01 | QA Agent | Initiate — 39 test cases across 6 levels |

---

## 1. Requirements Traceability Matrix (RTM)

| FR-ID | Requirement | UC | Test Cases | Coverage |
|-------|-------------|-----|-----------|----------|
| FR-1 | Thêm dependency elkjs vào backend/package.json | UC-2 | PBT-01, UT-01 | 100% |
| FR-2 | Giữ nguyên review mode (không sửa file) | UC-1 | PBT-02, UT-02, UT-03, IT-01, E2E-API-01 | 100% |
| FR-3 | Thêm tham số mode: review/apply (default review) | UC-1, UC-2 | PBT-03, UT-04, IT-02, E2E-API-02 | 100% |
| FR-4 | mode=apply + có issues: chạy ELK layered layout | UC-2, UC-3 | PBT-04, UT-05, IT-03, E2E-API-03 | 100% |
| FR-5 | Ghi tọa độ mới vào mxGeometry + edge routing | UC-4 | PBT-05, UT-06, IT-04, E2E-API-04 | 100% |
| FR-6 | Response apply: status, message, nodes, edges, issues, content_base64, repositioned_nodes | UC-2 | PBT-06, UT-07, IT-05, E2E-API-05 | 100% |
| FR-7 | Response review: status, message, nodes, edges, issues (no content_base64) | UC-1 | PBT-07, UT-08, E2E-API-06 | 100% |
| FR-8 | Giữ nguyên tham số layout: algorithm, spacing, direction | UC-1, UC-2 | PBT-08, UT-09, IT-06, E2E-API-07 | 100% |
| FR-9 | Cập nhật steering drawio.md với mode=apply workflow | UC-5 | SIT-01, SIT-02 | 100% |
| FR-10 | Cập nhật README backend (tùy chọn) | UC-5 | SIT-03 | 100% |
| FR-11 | Vitest unit tests cho review + apply modes | UC-1, UC-2 | SIT-04, SIT-05 | 100% |
| FR-12 | Không thay đổi drawio_export_png và test hiện có | UC-2 | SIT-06, SIT-07 | 100% |

**Coverage Summary:** 12/12 FRs covered = **100%**

---

## 2. Test Cases — Level 1: PBT (Package Based Testing)

> Package isolation tests — verify drawio tool package boundary, dependency, and contract.

### PBT-01: elkjs dependency exists in package.json

| Field | Value |
|-------|-------|
| **ID** | PBT-01 |
| **Title** | elkjs dependency exists in backend/package.json dependencies |
| **Priority** | High |
| **FR** | FR-1 |
| **Precondition** | Backend project exists with package.json |
| **Test Data** | `testdata/package-dependencies.csv` row 1 |
| **Steps** | 1. Read `backend/package.json`<br>2. Parse JSON<br>3. Check `dependencies.elkjs` exists<br>4. Verify version matches `^0.9.x` pattern |
| **Expected** | `elkjs` present in dependencies (NOT devDependencies); version `^0.9.x` |
| **Automation** | Vitest — `describe('PBT: package dependencies')` |

### PBT-02: Review mode preserves existing behavior (no content_base64)

| Field | Value |
|-------|-------|
| **ID** | PBT-02 |
| **Title** | handleDrawioLayout review mode returns NO content_base64 |
| **Priority** | Critical |
| **FR** | FR-2, FR-7 |
| **Precondition** | Tool registered, XML with edge crossing available |
| **Test Data** | `testdata/review-mode-inputs.csv` row 1 |
| **Steps** | 1. Call handleDrawioLayout with content_base64 and mode=review<br>2. Parse JSON response<br>3. Assert status is needs_fix or already_good<br>4. Assert content_base64 field does NOT exist<br>5. Assert repositioned_nodes does NOT exist |
| **Expected** | Response has status/message/nodes/edges/issues; NO content_base64 |
| **Automation** | Vitest |

### PBT-03: Mode parameter defaults to review

| Field | Value |
|-------|-------|
| **ID** | PBT-03 |
| **Title** | Omitting mode parameter defaults to review behavior |
| **Priority** | Critical |
| **FR** | FR-3 |
| **Precondition** | Valid XML base64 |
| **Test Data** | `testdata/review-mode-inputs.csv` row 2 |
| **Steps** | 1. Call handleDrawioLayout with content_base64 only (NO mode)<br>2. Parse response<br>3. Assert response matches review mode schema |
| **Expected** | Behavior identical to mode=review |
| **Automation** | Vitest |

### PBT-04: Apply mode triggers ELK layout when issues exist

| Field | Value |
|-------|-------|
| **ID** | PBT-04 |
| **Title** | mode=apply on XML with edge crossings runs ELK and returns fixed XML |
| **Priority** | Critical |
| **FR** | FR-4 |
| **Precondition** | XML with edge crossings encoded as base64 |
| **Test Data** | `testdata/apply-mode-inputs.csv` row 1 |
| **Steps** | 1. Call handleDrawioLayout with content_base64 (crossing XML) + mode=apply<br>2. Parse response<br>3. Assert status is fixed<br>4. Assert content_base64 exists and is non-empty<br>5. Assert repositioned_nodes is non-empty array |
| **Expected** | status=fixed, content_base64 present, repositioned_nodes.length > 0 |
| **Automation** | Vitest |

### PBT-05: Apply mode writes new coordinates into mxGeometry

| Field | Value |
|-------|-------|
| **ID** | PBT-05 |
| **Title** | Fixed XML contains updated x/y in mxGeometry nodes |
| **Priority** | Critical |
| **FR** | FR-5 |
| **Precondition** | Apply mode returns content_base64 |
| **Test Data** | `testdata/apply-mode-inputs.csv` row 1 |
| **Steps** | 1. Decode content_base64 from apply response<br>2. Parse XML<br>3. For each node in repositioned_nodes, find mxCell with id<br>4. Verify mxGeometry x/y matches x_new/y_new from repositioned_nodes |
| **Expected** | All repositioned nodes have new x/y in mxGeometry |
| **Automation** | Vitest |

### PBT-06: Apply response contains all required fields

| Field | Value |
|-------|-------|
| **ID** | PBT-06 |
| **Title** | Apply mode response JSON schema validation |
| **Priority** | High |
| **FR** | FR-6 |
| **Precondition** | Apply mode execution on XML with issues |
| **Test Data** | `testdata/apply-mode-inputs.csv` row 1 |
| **Steps** | 1. Call apply mode<br>2. Validate response has: status, message, nodes, edges, issues, content_base64, repositioned_nodes<br>3. Validate types: status=string, nodes=number, edges=number, issues=array, repositioned_nodes=array |
| **Expected** | All 7 fields present with correct types |
| **Automation** | Vitest |

### PBT-07: Review response excludes apply-only fields

| Field | Value |
|-------|-------|
| **ID** | PBT-07 |
| **Title** | Review mode response has exactly 5 fields (no apply fields) |
| **Priority** | High |
| **FR** | FR-7 |
| **Precondition** | Review mode call |
| **Test Data** | `testdata/review-mode-inputs.csv` row 1 |
| **Steps** | 1. Call review mode<br>2. Parse response<br>3. Assert fields: status, message, nodes, edges, issues<br>4. Assert NO content_base64, NO repositioned_nodes |
| **Expected** | Exactly 5 fields; apply-only fields absent |
| **Automation** | Vitest |

### PBT-08: Layout parameters preserved in both modes

| Field | Value |
|-------|-------|
| **ID** | PBT-08 |
| **Title** | algorithm/spacing/direction params accepted without error |
| **Priority** | Medium |
| **FR** | FR-8 |
| **Precondition** | Valid XML |
| **Test Data** | `testdata/layout-params.csv` |
| **Steps** | 1. Call with algorithm=layered, spacing=100, direction=RIGHT<br>2. Assert no error<br>3. Call with algorithm=force<br>4. Assert no error<br>5. Call with algorithm=mrtree<br>6. Assert no error<br>7. Call with algorithm=radial<br>8. Assert no error |
| **Expected** | All 4 algorithms accepted; spacing/direction honored |
| **Automation** | Vitest |


---

## 3. Test Cases — Level 2: UT (Unit Testing)

> Individual function-level tests for each module.

### UT-01: loadElk singleton returns ELK instance

| Field | Value |
|-------|-------|
| **ID** | UT-01 |
| **Title** | loadElk() returns ELK constructor (lazy singleton) |
| **Priority** | High |
| **FR** | FR-1 |
| **Precondition** | elkjs installed |
| **Test Data** | N/A |
| **Steps** | 1. Call loadElk()<br>2. Await result<br>3. Assert result has layout() method<br>4. Call loadElk() again<br>5. Assert same instance returned (singleton) |
| **Expected** | ELK loaded once, cached for subsequent calls |
| **Automation** | Vitest — elk-layout.test.ts |

### UT-02: detectAllIssues finds edge crossings

| Field | Value |
|-------|-------|
| **ID** | UT-02 |
| **Title** | detectAllIssues returns edge_crossing issue for crossing XML |
| **Priority** | Critical |
| **FR** | FR-2 |
| **Precondition** | DiagramGraph with crossing edges |
| **Test Data** | `testdata/diagram-graphs.csv` row 1 |
| **Steps** | 1. Create DiagramGraph with nodes at positions causing edge crossing<br>2. Call detectAllIssues(graph)<br>3. Assert result contains issue with type=edge_crossing |
| **Expected** | At least 1 edge_crossing issue detected |
| **Automation** | Vitest — drawio-tool.test.ts |

### UT-03: detectAllIssues returns empty for clean diagram

| Field | Value |
|-------|-------|
| **ID** | UT-03 |
| **Title** | detectAllIssues returns empty array for well-laid-out diagram |
| **Priority** | High |
| **FR** | FR-2 |
| **Precondition** | DiagramGraph with no issues |
| **Test Data** | `testdata/diagram-graphs.csv` row 2 |
| **Steps** | 1. Create DiagramGraph with non-overlapping nodes, orthogonal edges<br>2. Call detectAllIssues(graph)<br>3. Assert result is empty array |
| **Expected** | issues = [] |
| **Automation** | Vitest |

### UT-04: normalizeMode handles case-insensitive + invalid values

| Field | Value |
|-------|-------|
| **ID** | UT-04 |
| **Title** | normalizeMode normalizes REVIEW/Apply/bogus correctly |
| **Priority** | High |
| **FR** | FR-3 |
| **Precondition** | N/A |
| **Test Data** | `testdata/mode-normalization.csv` |
| **Steps** | 1. normalizeMode("REVIEW") => "review"<br>2. normalizeMode("Apply") => "apply"<br>3. normalizeMode("bogus") => "review" (fallback)<br>4. normalizeMode(undefined) => "review"<br>5. normalizeMode("") => "review" |
| **Expected** | All cases normalize correctly per D-1 |
| **Automation** | Vitest — drawio-apply.test.ts |

### UT-05: buildElkGraph maps DiagramGraph to ELK structure

| Field | Value |
|-------|-------|
| **ID** | UT-05 |
| **Title** | buildElkGraph produces correct ELK graph with children and edges |
| **Priority** | Critical |
| **FR** | FR-4 |
| **Precondition** | DiagramGraph with nodes, containers, edges |
| **Test Data** | `testdata/diagram-graphs.csv` row 3 |
| **Steps** | 1. Create DiagramGraph: 3 nodes + 1 container + 2 edges<br>2. Call buildElkGraph(graph, { algorithm: 'layered', spacing: 80, direction: 'DOWN' })<br>3. Assert root has children matching nodes<br>4. Assert container has children for nested nodes<br>5. Assert edges mapped to correct level (ADR-4) |
| **Expected** | ELK graph structure correct: nodes as children, edges at correct parent |
| **Automation** | Vitest — elk-layout.test.ts |

### UT-06: applyLayoutToXml updates mxGeometry x/y

| Field | Value |
|-------|-------|
| **ID** | UT-06 |
| **Title** | applyLayoutToXml writes new x/y into raw XML |
| **Priority** | Critical |
| **FR** | FR-5 |
| **Precondition** | Raw XML + ELK layout output with new positions |
| **Test Data** | `testdata/xml-writer-inputs.csv` row 1 |
| **Steps** | 1. Provide raw XML with node at x=10, y=20<br>2. Provide ELK output with same node at x=100, y=200<br>3. Call applyLayoutToXml(rawXml, laidOut)<br>4. Assert output XML has mxGeometry x=100, y=200 for that node |
| **Expected** | XML updated with new coordinates |
| **Automation** | Vitest — drawio-writer.test.ts |

### UT-07: repositioned_nodes contains old/new coordinates

| Field | Value |
|-------|-------|
| **ID** | UT-07 |
| **Title** | applyLayoutToXml returns repositionedNodes with x_old/y_old/x_new/y_new |
| **Priority** | High |
| **FR** | FR-6 |
| **Precondition** | Apply layout execution |
| **Test Data** | `testdata/xml-writer-inputs.csv` row 1 |
| **Steps** | 1. Call applyLayoutToXml<br>2. Check repositionedNodes array<br>3. Assert each entry has id, x_old, y_old, x_new, y_new<br>4. Assert x_old != x_new OR y_old != y_new for at least 1 node |
| **Expected** | repositionedNodes correctly reports before/after positions |
| **Automation** | Vitest |

### UT-08: handleDrawioLayout review mode error on missing content_base64

| Field | Value |
|-------|-------|
| **ID** | UT-08 |
| **Title** | Missing content_base64 returns error JSON |
| **Priority** | High |
| **FR** | FR-7 |
| **Precondition** | N/A |
| **Test Data** | `testdata/error-inputs.csv` row 1 |
| **Steps** | 1. Call handleDrawioLayout({}) (no content_base64)<br>2. Parse response<br>3. Assert response contains error field<br>4. Assert error = "content_base64 is required" |
| **Expected** | Error JSON returned, no crash |
| **Automation** | Vitest |

### UT-09: mapAlgorithm maps all 4 algorithms to ELK IDs

| Field | Value |
|-------|-------|
| **ID** | UT-09 |
| **Title** | mapAlgorithm returns correct ELK algorithm IDs |
| **Priority** | Medium |
| **FR** | FR-8 |
| **Precondition** | N/A |
| **Test Data** | `testdata/layout-params.csv` |
| **Steps** | 1. mapAlgorithm("layered") => "org.eclipse.elk.layered"<br>2. mapAlgorithm("force") => "org.eclipse.elk.force"<br>3. mapAlgorithm("mrtree") => "org.eclipse.elk.mrtree"<br>4. mapAlgorithm("radial") => "org.eclipse.elk.radial"<br>5. mapAlgorithm("bogus") => "org.eclipse.elk.layered" (fallback) |
| **Expected** | All mappings correct per D-3 |
| **Automation** | Vitest — elk-layout.test.ts |


---

## 4. Test Cases — Level 3: IT (Integration Testing)

> Tests verifying interactions between modules (parser + ELK + writer + apply orchestrator).

### IT-01: Review pipeline: decode -> parse -> detect -> response

| Field | Value |
|-------|-------|
| **ID** | IT-01 |
| **Title** | Full review pipeline from base64 input to JSON response |
| **Priority** | Critical |
| **FR** | FR-2 |
| **Precondition** | All modules available (drawio-tool, drawio-parser) |
| **Test Data** | `testdata/integration-xml.csv` row 1 |
| **Steps** | 1. Encode test XML (with edge crossing) to base64<br>2. Call handleDrawioLayout({ content_base64, mode: "review" })<br>3. Assert response is valid JSON<br>4. Assert status = "needs_fix"<br>5. Assert issues array contains edge_crossing type<br>6. Assert nodes count matches XML node count |
| **Expected** | Full pipeline produces correct review response |
| **Automation** | Vitest — drawio-tool.test.ts |

### IT-02: Mode dispatch: review vs apply produce different responses

| Field | Value |
|-------|-------|
| **ID** | IT-02 |
| **Title** | Same XML returns different response structure for review vs apply |
| **Priority** | Critical |
| **FR** | FR-3 |
| **Precondition** | XML with issues |
| **Test Data** | `testdata/integration-xml.csv` row 1 |
| **Steps** | 1. Call with mode=review -> response A<br>2. Call with mode=apply -> response B<br>3. Assert A has NO content_base64<br>4. Assert B HAS content_base64<br>5. Assert B has repositioned_nodes<br>6. Assert both have same issues array (before fix) |
| **Expected** | Review = detect only; Apply = detect + fix |
| **Automation** | Vitest |

### IT-03: Apply pipeline: parse -> detect -> ELK -> writer -> validate

| Field | Value |
|-------|-------|
| **ID** | IT-03 |
| **Title** | Full apply pipeline produces valid fixed XML |
| **Priority** | Critical |
| **FR** | FR-4 |
| **Precondition** | elkjs available, XML with crossings |
| **Test Data** | `testdata/integration-xml.csv` row 1 |
| **Steps** | 1. Encode crossing XML to base64<br>2. Call handleDrawioLayout({ content_base64, mode: "apply" })<br>3. Decode content_base64 from response<br>4. Parse decoded XML with parseDrawio<br>5. Assert parse succeeds (valid XML)<br>6. Assert nodes have positions different from original |
| **Expected** | Fixed XML is parseable; positions changed |
| **Automation** | Vitest |

### IT-04: Writer preserves non-geometry XML attributes

| Field | Value |
|-------|-------|
| **ID** | IT-04 |
| **Title** | applyLayoutToXml preserves style, labels, edge attributes |
| **Priority** | High |
| **FR** | FR-5 |
| **Precondition** | XML with styled nodes + labels |
| **Test Data** | `testdata/integration-xml.csv` row 2 |
| **Steps** | 1. Create XML with nodes having custom styles + labels<br>2. Run apply mode<br>3. Decode fixed XML<br>4. Assert all styles preserved byte-for-byte<br>5. Assert all labels unchanged<br>6. Assert only x/y attributes modified in mxGeometry |
| **Expected** | Non-geometry content preserved |
| **Automation** | Vitest |

### IT-05: Apply on clean XML returns already_good (no ELK run)

| Field | Value |
|-------|-------|
| **ID** | IT-05 |
| **Title** | Apply mode on diagram with 0 issues returns already_good |
| **Priority** | High |
| **FR** | FR-6 |
| **Precondition** | Clean XML (no overlaps/crossings/diagonals) |
| **Test Data** | `testdata/integration-xml.csv` row 3 |
| **Steps** | 1. Encode clean XML to base64<br>2. Call with mode=apply<br>3. Assert status = "already_good"<br>4. Assert NO content_base64 in response<br>5. Assert NO repositioned_nodes |
| **Expected** | ELK not triggered; status=already_good |
| **Automation** | Vitest |

### IT-06: Layout parameters affect ELK output

| Field | Value |
|-------|-------|
| **ID** | IT-06 |
| **Title** | Different spacing/direction produce different layouts |
| **Priority** | Medium |
| **FR** | FR-8 |
| **Precondition** | XML with crossings |
| **Test Data** | `testdata/layout-params.csv` |
| **Steps** | 1. Call apply with spacing=40, direction=DOWN -> response A<br>2. Call apply with spacing=120, direction=RIGHT -> response B<br>3. Compare repositioned_nodes between A and B<br>4. Assert positions differ (layout influenced by params) |
| **Expected** | Different params produce different node positions |
| **Automation** | Vitest |


---

## 5. Test Cases — Level 4: E2E-API (End-to-End API Testing)

> Full MCP tool call simulation: JSON-RPC request -> tool handler -> JSON response.

### E2E-API-01: MCP tool call review mode with crossing XML

| Field | Value |
|-------|-------|
| **ID** | E2E-API-01 |
| **Title** | Full MCP drawio_auto_layout call (review) returns needs_fix |
| **Priority** | Critical |
| **FR** | FR-2 |
| **Precondition** | Backend running, tool registered |
| **Test Data** | `testdata/e2e-xml-samples.csv` row 1 |
| **Steps** | 1. Prepare MCP tools/call request: tool=drawio_auto_layout, args={content_base64, mode: review}<br>2. Execute via tool handler dispatch<br>3. Parse JSON string response<br>4. Assert status=needs_fix<br>5. Assert issues.length >= 1<br>6. Assert each issue has type, severity, fix_hint |
| **Expected** | Complete review flow via MCP dispatch |
| **Automation** | Vitest — e2e integration test |

### E2E-API-02: MCP tool call with invalid mode falls back to review

| Field | Value |
|-------|-------|
| **ID** | E2E-API-02 |
| **Title** | Invalid mode value treated as review (D-1) |
| **Priority** | Medium |
| **FR** | FR-3 |
| **Precondition** | Tool registered |
| **Test Data** | `testdata/e2e-xml-samples.csv` row 2 |
| **Steps** | 1. Call with mode="bogus"<br>2. Assert NO error returned<br>3. Assert response matches review schema<br>4. Assert NO content_base64 |
| **Expected** | Fallback to review; no error |
| **Automation** | Vitest |

### E2E-API-03: MCP tool call apply mode produces fixed XML

| Field | Value |
|-------|-------|
| **ID** | E2E-API-03 |
| **Title** | Full apply mode via MCP returns fixed content_base64 |
| **Priority** | Critical |
| **FR** | FR-4 |
| **Precondition** | elkjs installed, XML with crossings |
| **Test Data** | `testdata/e2e-xml-samples.csv` row 1 |
| **Steps** | 1. MCP call: drawio_auto_layout, args={content_base64, mode: apply}<br>2. Assert status=fixed<br>3. Decode content_base64<br>4. Assert valid mxGraphModel XML<br>5. Re-call review mode on fixed XML<br>6. Assert issues count reduced or zero |
| **Expected** | Apply fixes issues; re-review confirms improvement |
| **Automation** | Vitest |

### E2E-API-04: Fixed XML has updated edge waypoints

| Field | Value |
|-------|-------|
| **ID** | E2E-API-04 |
| **Title** | Apply mode returns XML with edge routing (Array as=points) |
| **Priority** | High |
| **FR** | FR-5 |
| **Precondition** | Apply mode on XML with edge crossings |
| **Test Data** | `testdata/e2e-xml-samples.csv` row 1 |
| **Steps** | 1. Call apply mode<br>2. Decode content_base64<br>3. Check edge cells in XML for Array as="points" elements<br>4. Verify bend points are valid numbers (not NaN) |
| **Expected** | Edge routing waypoints present in fixed XML |
| **Automation** | Vitest |

### E2E-API-05: Apply response repositioned_nodes schema validation

| Field | Value |
|-------|-------|
| **ID** | E2E-API-05 |
| **Title** | repositioned_nodes array entries have correct schema |
| **Priority** | High |
| **FR** | FR-6 |
| **Precondition** | Apply mode execution |
| **Test Data** | `testdata/e2e-xml-samples.csv` row 1 |
| **Steps** | 1. Call apply mode<br>2. Get repositioned_nodes from response<br>3. For each entry: assert has id (string), x_old (number), y_old (number), x_new (number), y_new (number)<br>4. Assert at least 1 entry where x_old != x_new or y_old != y_new |
| **Expected** | Each repositioned_node has 5 fields with correct types |
| **Automation** | Vitest |

### E2E-API-06: Review mode on clean XML returns already_good

| Field | Value |
|-------|-------|
| **ID** | E2E-API-06 |
| **Title** | Clean XML review returns status=already_good, issues=[] |
| **Priority** | High |
| **FR** | FR-7 |
| **Precondition** | Well-laid-out XML |
| **Test Data** | `testdata/e2e-xml-samples.csv` row 3 |
| **Steps** | 1. Call review on XML with no issues<br>2. Assert status=already_good<br>3. Assert issues is empty array<br>4. Assert message indicates no issues found |
| **Expected** | Clean diagram detected correctly |
| **Automation** | Vitest |

### E2E-API-07: Apply with custom algorithm/spacing/direction

| Field | Value |
|-------|-------|
| **ID** | E2E-API-07 |
| **Title** | Apply mode respects algorithm=force, spacing=120, direction=RIGHT |
| **Priority** | Medium |
| **FR** | FR-8 |
| **Precondition** | XML with crossings |
| **Test Data** | `testdata/layout-params.csv` |
| **Steps** | 1. Call apply with algorithm=force, spacing=120, direction=RIGHT<br>2. Assert status=fixed (or already_good if force layout resolves)<br>3. Assert no error<br>4. If fixed: verify positions reflect RIGHT direction |
| **Expected** | Custom params accepted and applied |
| **Automation** | Vitest |


---

## 6. Test Cases — Level 5: E2E-UI (End-to-End UI / Visual Testing)

> Verify diagram visual output: PNG export from fixed XML, visual quality checks.

### E2E-UI-01: Fixed XML exports to valid PNG

| Field | Value |
|-------|-------|
| **ID** | E2E-UI-01 |
| **Title** | Fixed XML from apply mode exports to PNG without error |
| **Priority** | High |
| **FR** | FR-4, FR-12 |
| **Precondition** | Apply mode returns content_base64; draw.io CLI available |
| **Test Data** | `testdata/e2e-xml-samples.csv` row 1 |

**Gherkin:**

```
Feature: Diagram PNG Export After Fix
  Scenario: Export fixed XML to PNG
    Given apply mode returned content_base64 for crossing diagram
    When I decode content_base64 and write to temp.drawio file
    And I run drawio_export_png on the temp.drawio file
    Then PNG file is created successfully
    And PNG file size is greater than 0 bytes
    And no error is reported by export tool
```

| **Expected** | PNG generated from fixed XML without errors |
| **Automation** | Vitest + drawio CLI mock |

### E2E-UI-02: Fixed diagram has no visual overlaps

| Field | Value |
|-------|-------|
| **ID** | E2E-UI-02 |
| **Title** | Visual check: no node overlaps in fixed diagram |
| **Priority** | Medium |
| **FR** | FR-4, FR-5 |
| **Precondition** | Fixed XML decoded |
| **Test Data** | `testdata/e2e-xml-samples.csv` row 1 |

**Gherkin:**

```
Feature: No Visual Overlaps After Fix
  Scenario: Verify no overlapping nodes
    Given apply mode fixed an XML with edge crossings
    When I parse the fixed XML
    And I check all node bounding boxes
    Then no two nodes have overlapping bounding boxes
    And all nodes are within canvas bounds (x>=0, y>=0)
```

| **Expected** | Zero node overlaps in fixed output |
| **Automation** | Vitest (geometric assertion) |

### E2E-UI-03: Edge crossings reduced after apply

| Field | Value |
|-------|-------|
| **ID** | E2E-UI-03 |
| **Title** | Visual check: edge crossings reduced or eliminated |
| **Priority** | High |
| **FR** | FR-4 |
| **Precondition** | Original XML has edge crossings; fixed XML from apply |
| **Test Data** | `testdata/e2e-xml-samples.csv` row 1 |

**Gherkin:**

```
Feature: Edge Crossings Reduced
  Scenario: Compare crossings before and after fix
    Given original XML has N edge crossings detected
    When apply mode fixes the diagram
    And I run review on the fixed XML
    Then the number of edge_crossing issues is less than N
```

| **Expected** | Edge crossings count decreases after fix |
| **Automation** | Vitest (call review on fixed XML, compare counts) |

### E2E-UI-04: Labels and styles preserved in visual output

| Field | Value |
|-------|-------|
| **ID** | E2E-UI-04 |
| **Title** | Node labels and styles preserved after layout fix |
| **Priority** | High |
| **FR** | FR-5 |
| **Precondition** | XML with styled/labeled nodes |
| **Test Data** | `testdata/e2e-xml-samples.csv` row 2 |

**Gherkin:**

```
Feature: Preserve Labels and Styles
  Scenario: Styles and labels unchanged after apply
    Given XML has nodes with custom styles and labels
    When apply mode fixes the layout
    Then decoded XML contains all original node labels
    And all original style attributes are preserved
    And only x/y geometry attributes are modified
```

| **Expected** | Visual identity of nodes preserved |
| **Automation** | Vitest (XML string comparison for style/value attributes) |

### E2E-UI-05: Container/swimlane resized correctly

| Field | Value |
|-------|-------|
| **ID** | E2E-UI-05 |
| **Title** | Containers resize to fit children after ELK layout |
| **Priority** | Medium |
| **FR** | FR-4, FR-5 |
| **Precondition** | XML with container holding child nodes |
| **Test Data** | `testdata/e2e-xml-samples.csv` row 4 |

**Gherkin:**

```
Feature: Container Resize
  Scenario: Container bounds encompass all children
    Given XML has a container with 3 child nodes
    When apply mode fixes the layout
    Then container mxGeometry width >= max(child.x + child.width) - min(child.x) + spacing
    And container mxGeometry height >= max(child.y + child.height) - min(child.y) + spacing
```

| **Expected** | Container properly resized around children |
| **Automation** | Vitest (geometric bounds check) |

### E2E-UI-06: Negative coordinates shifted to origin

| Field | Value |
|-------|-------|
| **ID** | E2E-UI-06 |
| **Title** | ELK output with negative coords shifted to (0,0) |
| **Priority** | Medium |
| **FR** | FR-4 |
| **Precondition** | Apply with direction=LEFT or UP (may produce negatives) |
| **Test Data** | `testdata/layout-params.csv` row 3 |

**Gherkin:**

```
Feature: Normalize Negative Coordinates
  Scenario: All nodes on canvas (no negative x/y)
    Given apply mode runs with direction=LEFT
    When I decode the fixed XML
    Then all node mxGeometry x values are >= 0
    And all node mxGeometry y values are >= 0
```

| **Expected** | No negative coordinates in output (D-10) |
| **Automation** | Vitest |


---

## 7. Test Cases — Level 6: SIT (System Integration Testing)

> Full SDLC pipeline integration: steering, tests, existing suite, documentation.

### SIT-01: Steering file contains mode=apply workflow

| Field | Value |
|-------|-------|
| **ID** | SIT-01 |
| **Title** | .kiro/steering/drawio.md contains mode=apply guidance |
| **Priority** | High |
| **FR** | FR-9 |
| **Precondition** | Steering file updated |
| **Test Data** | N/A |
| **Steps** | 1. Read .kiro/steering/drawio.md<br>2. Search for mode=apply or mode="apply"<br>3. Assert section exists with workflow steps<br>4. Assert example JSON call present<br>5. Assert step "write back XML" documented<br>6. Assert step "re-export PNG" documented |
| **Expected** | Steering has complete mode=apply workflow |
| **Automation** | Vitest (file content assertion) |

### SIT-02: Steering preserves existing rules

| Field | Value |
|-------|-------|
| **ID** | SIT-02 |
| **Title** | Existing steering rules not removed after update |
| **Priority** | High |
| **FR** | FR-9 |
| **Precondition** | Steering updated |
| **Test Data** | N/A |
| **Steps** | 1. Read .kiro/steering/drawio.md<br>2. Assert edge routing rules still present<br>3. Assert mxGraphModel rules still present<br>4. Assert no-mxfile-wrapper rule still present<br>5. Compare section headers with pre-update snapshot |
| **Expected** | All pre-existing rules preserved |
| **Automation** | Vitest (snapshot or string assertions) |

### SIT-03: Backend README lists mode=apply capability

| Field | Value |
|-------|-------|
| **ID** | SIT-03 |
| **Title** | Backend README/docs mention apply mode (FR-10) |
| **Priority** | Low |
| **FR** | FR-10 |
| **Precondition** | README updated (COULD HAVE) |
| **Test Data** | N/A |
| **Steps** | 1. Read backend/README.md<br>2. Search for drawio_auto_layout tool section<br>3. If exists: assert mentions mode parameter<br>4. If not exists: log as acceptable (COULD HAVE) |
| **Expected** | README mentions mode=apply if tool section exists |
| **Automation** | Vitest (conditional assertion) |

### SIT-04: Vitest suite for review mode passes

| Field | Value |
|-------|-------|
| **ID** | SIT-04 |
| **Title** | npx vitest run drawio-tool.test.ts passes for review tests |
| **Priority** | Critical |
| **FR** | FR-11 |
| **Precondition** | Test file created at __tests__/drawio-tool.test.ts |
| **Test Data** | Inline test XML in test file |
| **Steps** | 1. Run npx vitest run src/engine/tools/__tests__/drawio-tool.test.ts<br>2. Assert exit code 0<br>3. Assert all review mode tests pass<br>4. Assert >= 3 review test cases exist |
| **Expected** | All review mode tests green |
| **Automation** | CLI execution + exit code check |

### SIT-05: Vitest suite for apply mode passes

| Field | Value |
|-------|-------|
| **ID** | SIT-05 |
| **Title** | npx vitest run drawio-tool.test.ts passes for apply tests |
| **Priority** | Critical |
| **FR** | FR-11 |
| **Precondition** | Test file with apply mode tests |
| **Test Data** | Inline test XML in test file |
| **Steps** | 1. Run npx vitest run (apply tests)<br>2. Assert exit code 0<br>3. Assert apply mode tests pass: (a) fixes crossing, (b) returns content_base64, (c) clean XML returns already_good |
| **Expected** | All apply mode tests green |
| **Automation** | CLI execution |

### SIT-06: Existing drawio-export.test.ts still passes

| Field | Value |
|-------|-------|
| **ID** | SIT-06 |
| **Title** | drawio-export.test.ts not broken by changes |
| **Priority** | Critical |
| **FR** | FR-12 |
| **Precondition** | Code changes applied |
| **Test Data** | N/A |
| **Steps** | 1. Run npx vitest run tests/integration/drawio-export.test.ts<br>2. Assert exit code 0<br>3. Assert all existing tests pass unchanged |
| **Expected** | Zero regressions in export tests |
| **Automation** | CLI execution |

### SIT-07: Existing CoreTools.test.ts and sa4e-testkit.ts still pass

| Field | Value |
|-------|-------|
| **ID** | SIT-07 |
| **Title** | CoreTools.test.ts and sa4e-testkit.ts not broken |
| **Priority** | Critical |
| **FR** | FR-12 |
| **Precondition** | Code changes applied |
| **Test Data** | N/A |
| **Steps** | 1. Run npx vitest run src/config/__tests__/CoreTools.test.ts<br>2. Assert exit code 0<br>3. Run npx vitest run src/__tests__/sa4e-testkit.ts<br>4. Assert exit code 0 |
| **Expected** | Zero regressions in existing test suites |
| **Automation** | CLI execution |


---

## 8. Error Handling and Edge Case Tests

### ERR-01: Invalid base64 returns error JSON

| Field | Value |
|-------|-------|
| **ID** | ERR-01 |
| **Title** | Non-base64 content returns Analysis failed error |
| **Level** | IT |
| **FR** | FR-2, FR-3 |
| **Steps** | 1. Call with content_base64="not_valid_base64!!!"<br>2. Assert response has error field<br>3. Assert error contains "Analysis failed" |
| **Expected** | Graceful error, no crash |

### ERR-02: Malformed XML returns error JSON

| Field | Value |
|-------|-------|
| **ID** | ERR-02 |
| **Title** | Valid base64 of malformed XML returns error |
| **Level** | IT |
| **FR** | FR-2 |
| **Steps** | 1. Encode broken xml to base64<br>2. Call handleDrawioLayout<br>3. Assert error in response |
| **Expected** | Error JSON without crash |

### ERR-03: Empty diagram (no nodes) returns error

| Field | Value |
|-------|-------|
| **ID** | ERR-03 |
| **Title** | XML with only root cells returns No nodes found |
| **Level** | IT |
| **FR** | FR-2 |
| **Steps** | 1. Encode minimal mxGraphModel with only cells 0 and 1<br>2. Call handleDrawioLayout<br>3. Assert error = "No nodes found in diagram" |
| **Expected** | Clear error message |

### ERR-04: ELK timeout on large diagram

| Field | Value |
|-------|-------|
| **ID** | ERR-04 |
| **Title** | ELK layout exceeding timeout returns error |
| **Level** | IT |
| **FR** | FR-4 |
| **Steps** | 1. Mock elkjs to delay beyond SA4E_ELK_TIMEOUT_MS<br>2. Call apply mode<br>3. Assert error contains "timed out" |
| **Expected** | Timeout error, no hung process |

### ERR-05: Node count exceeds limit

| Field | Value |
|-------|-------|
| **ID** | ERR-05 |
| **Title** | Diagram with more than 500 nodes returns error |
| **Level** | IT |
| **FR** | FR-4 |
| **Steps** | 1. Create XML with 501 nodes<br>2. Call apply mode<br>3. Assert error about node limit exceeded |
| **Expected** | Guard prevents ELK on oversized diagrams |

### ERR-06: ELK returns invalid output

| Field | Value |
|-------|-------|
| **ID** | ERR-06 |
| **Title** | ELK output validation catches NaN coordinates |
| **Level** | UT |
| **FR** | FR-4 |
| **Steps** | 1. Mock ELK to return node with x=NaN<br>2. Call runElkLayout<br>3. Assert throws error |
| **Expected** | Validation catches invalid ELK output |

### ERR-07: Re-parse validation rollback

| Field | Value |
|-------|-------|
| **ID** | ERR-07 |
| **Title** | Broken XML after write triggers rollback |
| **Level** | IT |
| **FR** | FR-4, FR-5 |
| **Steps** | 1. Mock applyLayoutToXml to produce broken XML<br>2. handleApply detects re-parse failure<br>3. Assert error returned, no content_base64 |
| **Expected** | Rollback on invalid output (BR-7) |

---

## 9. Performance Tests

### PERF-01: ELK layout within 10s for 200 nodes

| Field | Value |
|-------|-------|
| **ID** | PERF-01 |
| **Title** | ELK layout completes within timeout for typical diagram |
| **Level** | IT |
| **FR** | NFR Performance |
| **Steps** | 1. Generate 200-node diagram<br>2. Call apply mode<br>3. Measure time<br>4. Assert less than 10000ms |
| **Expected** | Layout within timeout |

### PERF-02: Lazy-load no startup impact

| Field | Value |
|-------|-------|
| **ID** | PERF-02 |
| **Title** | elkjs not loaded at import time |
| **Level** | SIT |
| **FR** | NFR Performance |
| **Steps** | 1. Import drawio-tool.ts<br>2. Verify elkjs NOT loaded<br>3. Only loads when mode=apply called |
| **Expected** | Zero startup time impact |

---

## 10. Test Data Reference

| File | Purpose | Test Cases |
|------|---------|-----------|
| testdata/package-dependencies.csv | Expected package.json dependencies | PBT-01 |
| testdata/review-mode-inputs.csv | Review mode input combinations | PBT-02, PBT-03, PBT-07 |
| testdata/apply-mode-inputs.csv | Apply mode input combinations | PBT-04, PBT-05, PBT-06 |
| testdata/layout-params.csv | Algorithm/spacing/direction combinations | PBT-08, UT-09, IT-06, E2E-API-07, E2E-UI-06 |
| testdata/mode-normalization.csv | Mode parameter edge cases | UT-04 |
| testdata/diagram-graphs.csv | DiagramGraph structures for unit tests | UT-02, UT-03, UT-05 |
| testdata/xml-writer-inputs.csv | Raw XML + ELK output pairs | UT-06, UT-07 |
| testdata/integration-xml.csv | Full XML samples for integration tests | IT-01..IT-06 |
| testdata/e2e-xml-samples.csv | End-to-end XML test samples | E2E-API-01..07, E2E-UI-01..06 |
| testdata/error-inputs.csv | Invalid inputs for error handling | UT-08, ERR-01..07 |

---

## 11. Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Test Coverage | [test-coverage.png](diagrams/test-coverage.png) | [test-coverage.drawio](diagrams/test-coverage.drawio) |
| 2 | Test Execution Flow | [test-execution-flow.png](diagrams/test-execution-flow.png) | [test-execution-flow.drawio](diagrams/test-execution-flow.drawio) |

---

## 12. Appendix: Test Summary

| Level | Count | Automation | Tool |
|-------|-------|-----------|------|
| PBT | 8 | 100% | Vitest |
| UT | 9 | 100% | Vitest |
| IT | 6 | 100% | Vitest |
| E2E-API | 7 | 100% | Vitest |
| E2E-UI | 6 | 100% | Vitest + draw.io CLI |
| SIT | 7 | 100% | Vitest + CLI |
| Error/Edge | 7 | 100% | Vitest |
| Performance | 2 | 100% | Vitest |
| **TOTAL** | **52** | **100%** | |
