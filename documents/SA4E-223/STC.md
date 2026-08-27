# Software Test Cases (STC) — SA4E-223

## SA4E-223 — Indexer không nhận diện hầu hết các phần mở rộng tệp Salesforce (metadata + Aura/Visualforce) trong quá trình lập chỉ mục mã nguồn

---

## Thông tin tài liệu (Document Information)

| Trường | Giá trị |
|--------|---------|
| Jira Ticket | SA4E-223 |
| Tiêu đề | Indexer does not recognize most Salesforce file extensions (metadata + Aura/Visualforce) during source indexing |
| Tác giả | QA Agent |
| Phiên bản | 1.0 |
| Ngày | 2026-08-27 |
| Trạng thái | Draft |
| Tài liệu liên quan | STP v1.0, FSD v1.1, TDD v1.0 (tại `documents/SA4E-223/`) |

---

## Lịch sử phiên bản (Revision History)

| Phiên bản | Ngày | Tác giả | Thay đổi |
|-----------|------|---------|----------|
| 1.0 | 2026-08-27 | QA Agent | Khởi tạo STC — từ FSD use cases, business rules, BRD 7 AC, và 3 security findings |

---

## Tóm tắt Test Cases (Test Case Summary)

| Danh mục | ID Range | Số lượng | Độ ưu tiên |
|----------|----------|----------|------------|
| detectLanguage — 9 simple extensions | TC-001 – TC-009 | 9 | High |
| detectLanguage — 17 compound-suffix | TC-010 – TC-026 | 17 | High |
| detectLanguage — regression & unknown | TC-027 – TC-030 | 4 | High |
| Gate 2 (includeExtensions) cả 2 scanner | TC-031 – TC-034 | 4 | High |
| grammar-config parser selection | TC-035 – TC-040 | 6 | High |
| detectModule ánh xạ module | TC-041 – TC-057 | 17 | High |
| Sub-parser salesforce-meta (mới + regression) | TC-058 – TC-072 | 15 | High |
| Graceful degradation (XML lỗi) | TC-073 – TC-075 | 3 | High |
| VF/Aura parser (mới) | TC-076 – TC-081 | 6 | High |
| Security (3 Medium findings) | TC-ReDoS, TC-Secret-Allowlist, TC-Symlink-Escape | 3 | High |
| AC7 — file ≤200 dòng / CI / branch coverage | TC-082 – TC-084 | 3 | Medium |
| Integration (SFDX stats + pipeline) | TC-085 – TC-086 | 2 | High |
| **Tổng** | | **89** | |

---

## 1. Unit Test — `file-scanner.ts` `detectLanguage` (AC1 / UC-01)

### TC-001: detectLanguage `.apex` → `apex`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-001 |
| **Độ ưu tiên** | High |
| **Loại** | Functional — Happy Path |
| **Requirement** | Story 1 / AC1 / UC-01 / BR-1 |
| **Preconditions** | `file-scanner.ts` đã cập nhật `EXTENSION_LANGUAGE_MAP` với `.apex` |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Gọi `detectLanguage('MyClass.apex')` | Trả `'apex'` (non-null) |
| 2 | Gọi `detectLanguage('src/foo/Bar.soql')` | Trả `'apex'` |

**Test Data:** `MyClass.apex`, `Bar.soql`
**Postconditions:** Không có extension nào trả `null`.

---

### TC-002: detectLanguage `.soql` → `apex`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-002 |
| **Độ ưu tiên** | High |
| **Loại** | Functional — Happy Path |
| **Requirement** | Story 1 / AC1 / UC-01 / BR-1 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Gọi `detectLanguage('query.soql')` | Trả `'apex'` |

**Test Data:** `query.soql`
**Postconditions:** Non-null.

---

### TC-003: detectLanguage `.page` → `visualforce`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-003 |
| **Độ ưu tiên** | High |
| **Loại** | Functional — Happy Path |
| **Requirement** | Story 1 / AC1 / UC-01 / BR-3 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Gọi `detectLanguage('MyPage.page')` | Trả `'visualforce'` |

**Test Data:** `MyPage.page`
**Postconditions:** Non-null.

---

### TC-004: detectLanguage `.component` (Visualforce) → `visualforce`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-004 |
| **Độ ưu tiên** | High |
| **Loại** | Functional — Happy Path |
| **Requirement** | Story 1 / AC1 / UC-01 / BR-3 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Gọi `detectLanguage('MyComponent.component')` | Trả `'visualforce'` (KHÔNG phải `aura`) |

**Test Data:** `MyComponent.component`
**Postconditions:** Phân biệt với `component-meta.xml` (BR-3).

---

### TC-005: detectLanguage `.cmp` → `aura`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-005 |
| **Độ ưu tiên** | High |
| **Loại** | Functional — Happy Path |
| **Requirement** | Story 1 / AC1 / UC-01 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Gọi `detectLanguage('MyCmp.cmp')` | Trả `'aura'` |

**Test Data:** `MyCmp.cmp`

---

### TC-006: detectLanguage `.app` → `aura`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-006 |
| **Độ ưu tiên** | High |
| **Loại** | Functional — Happy Path |
| **Requirement** | Story 1 / AC1 / UC-01 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Gọi `detectLanguage('MyApp.app')` | Trả `'aura'` |

**Test Data:** `MyApp.app`

---

### TC-007: detectLanguage `.evt` → `aura`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-007 |
| **Độ ưu tiên** | High |
| **Loại** | Functional — Happy Path |
| **Requirement** | Story 1 / AC1 / UC-01 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Gọi `detectLanguage('MyEvent.evt')` | Trả `'aura'` |

**Test Data:** `MyEvent.evt`

---

### TC-008: detectLanguage `.intf` → `aura`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-008 |
| **Độ ưu tiên** | High |
| **Loại** | Functional — Happy Path |
| **Requirement** | Story 1 / AC1 / UC-01 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Gọi `detectLanguage('MyIntf.intf')` | Trả `'aura'` |

**Test Data:** `MyIntf.intf`

---

### TC-009: detectLanguage `.tokens` → `aura`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-009 |
| **Độ ưu tiên** | High |
| **Loại** | Functional — Happy Path |
| **Requirement** | Story 1 / AC1 / UC-01 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Gọi `detectLanguage('design.tokens')` | Trả `'aura'` |

**Test Data:** `design.tokens`

---

### TC-010: detectLanguage `.flow-meta.xml` → `salesforce-meta`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-010 |
| **Độ ưu tiên** | High |
| **Loại** | Functional — Happy Path |
| **Requirement** | Story 1 / AC1 / UC-01 / BR-2 (compound-suffix) |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Gọi `detectLanguage('MyFlow.flow-meta.xml')` | Trả `'salesforce-meta'` |

**Test Data:** `MyFlow.flow-meta.xml`

---

### TC-011: detectLanguage `.object-meta.xml` → `salesforce-meta`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-011 |
| **Độ ưu tiên** | High |
| **Loại** | Functional — Happy Path |
| **Requirement** | Story 1 / AC1 / UC-01 / BR-2 (open item resolved §2.3 FSD) |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Gọi `detectLanguage('Account.object-meta.xml')` | Trả `'salesforce-meta'` |

**Test Data:** `Account.object-meta.xml`

---

### TC-012: detectLanguage `.field-meta.xml` → `salesforce-meta`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-012 |
| **Độ ưu tiên** | High |
| **Loại** | Functional — Happy Path |
| **Requirement** | Story 1 / AC1 / UC-01 / BR-2 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Gọi `detectLanguage('Field__c.field-meta.xml')` | Trả `'salesforce-meta'` |

**Test Data:** `Field__c.field-meta.xml`

---

### TC-013: detectLanguage `.js-meta.xml` → `salesforce-meta`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-013 |
| **Độ ưu tiên** | High |
| **Loại** | Functional — Happy Path |
| **Requirement** | Story 1 / AC1 / UC-01 / BR-2 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Gọi `detectLanguage('myCmp.js-meta.xml')` | Trả `'salesforce-meta'` |

**Test Data:** `myCmp.js-meta.xml`

---

### TC-014: detectLanguage `.component-meta.xml` → `salesforce-meta`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-014 |
| **Độ ưu tiên** | High |
| **Loại** | Functional — Happy Path |
| **Requirement** | Story 1 / AC1 / UC-01 / BR-2 / BR-3 (Aura meta, NOT visualforce) |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Gọi `detectLanguage('MyAura.component-meta.xml')` | Trả `'salesforce-meta'` (khác với `.component` → `visualforce`) |

**Test Data:** `MyAura.component-meta.xml`

---

### TC-015: detectLanguage `.flexipage-meta.xml` → `salesforce-meta`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-015 |
| **Độ ưu tiên** | High |
| **Loại** | Functional — Happy Path |
| **Requirement** | Story 1 / AC1 / UC-01 / BR-2 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Gọi `detectLanguage('Home.flexipage-meta.xml')` | Trả `'salesforce-meta'` |

**Test Data:** `Home.flexipage-meta.xml`

---

### TC-016: detectLanguage `.permissionset-meta.xml` → `salesforce-meta`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-016 |
| **Độ ưu tiên** | High |
| **Loại** | Functional — Happy Path |
| **Requirement** | Story 1 / AC1 / UC-01 / BR-2 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Gọi `detectLanguage('MyPS.permissionset-meta.xml')` | Trả `'salesforce-meta'` |

**Test Data:** `MyPS.permissionset-meta.xml`

---

### TC-017: detectLanguage `.profile-meta.xml` → `salesforce-meta`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-017 |
| **Độ ưu tiên** | High |
| **Loại** | Functional — Happy Path |
| **Requirement** | Story 1 / AC1 / UC-01 / BR-2 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Gọi `detectLanguage('Admin.profile-meta.xml')` | Trả `'salesforce-meta'` |

**Test Data:** `Admin.profile-meta.xml`

---

### TC-018: detectLanguage `.labels-meta.xml` → `salesforce-meta`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-018 |
| **Độ ưu tiên** | High |
| **Loại** | Functional — Happy Path |
| **Requirement** | Story 1 / AC1 / UC-01 / BR-2 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Gọi `detectLanguage('CustomLabels.labels-meta.xml')` | Trả `'salesforce-meta'` |

**Test Data:** `CustomLabels.labels-meta.xml`

---

### TC-019: detectLanguage `.tab-meta.xml` → `salesforce-meta`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-019 |
| **Độ ưu tiên** | High |
| **Loại** | Functional — Happy Path |
| **Requirement** | Story 1 / AC1 / UC-01 / BR-2 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Gọi `detectLanguage('MyTab.tab-meta.xml')` | Trả `'salesforce-meta'` |

**Test Data:** `MyTab.tab-meta.xml`

---

### TC-020: detectLanguage `.layout-meta.xml` → `salesforce-meta`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-020 |
| **Độ ưu tiên** | High |
| **Loại** | Functional — Happy Path |
| **Requirement** | Story 1 / AC1 / UC-01 / BR-2 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Gọi `detectLanguage('Account-Account Layout.layout-meta.xml')` | Trả `'salesforce-meta'` |

**Test Data:** `Account-Account Layout.layout-meta.xml`

---

### TC-021: detectLanguage `.report-meta.xml` → `salesforce-meta`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-021 |
| **Độ ưu tiên** | High |
| **Loại** | Functional — Happy Path |
| **Requirement** | Story 1 / AC1 / UC-01 / BR-2 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Gọi `detectLanguage('MyReport.report-meta.xml')` | Trả `'salesforce-meta'` |

**Test Data:** `MyReport.report-meta.xml`

---

### TC-022: detectLanguage `.dashboard-meta.xml` → `salesforce-meta`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-022 |
| **Độ ưu tiên** | High |
| **Loại** | Functional — Happy Path |
| **Requirement** | Story 1 / AC1 / UC-01 / BR-2 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Gọi `detectLanguage('MyDash.dashboard-meta.xml')` | Trả `'salesforce-meta'` |

**Test Data:** `MyDash.dashboard-meta.xml`

---

### TC-023: detectLanguage `.site-meta.xml` → `salesforce-meta`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-023 |
| **Độ ưu tiên** | High |
| **Loại** | Functional — Happy Path |
| **Requirement** | Story 1 / AC1 / UC-01 / BR-2 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Gọi `detectLanguage('MySite.site-meta.xml')` | Trả `'salesforce-meta'` |

**Test Data:** `MySite.site-meta.xml`

---

### TC-024: detectLanguage `.resource-meta.xml` → `salesforce-meta`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-024 |
| **Độ ưu tiên** | High |
| **Loại** | Functional — Happy Path |
| **Requirement** | Story 1 / AC1 / UC-01 / BR-2 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Gọi `detectLanguage('logo.resource-meta.xml')` | Trả `'salesforce-meta'` |

**Test Data:** `logo.resource-meta.xml`

---

### TC-025: detectLanguage `.email-meta.xml` → `salesforce-meta`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-025 |
| **Độ ưu tiên** | High |
| **Loại** | Functional — Happy Path |
| **Requirement** | Story 1 / AC1 / UC-01 / BR-2 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Gọi `detectLanguage('Welcome.email-meta.xml')` | Trả `'salesforce-meta'` |

**Test Data:** `Welcome.email-meta.xml`

---

### TC-026: detectLanguage `.testSuite-meta.xml` → `salesforce-meta`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-026 |
| **Độ ưu tiên** | High |
| **Loại** | Functional — Happy Path |
| **Requirement** | Story 1 / AC1 / UC-01 / BR-2 / SA-CONF-3 (chỉ `-meta.xml`, bỏ standalone) |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Gọi `detectLanguage('MySuite.testSuite-meta.xml')` | Trả `'salesforce-meta'` |
| 2 | Gọi `detectLanguage('MySuite.testSuite')` (standalone không tồn tại) | Trả `null` (SA-CONF-3 RESOLVED) |

**Test Data:** `MySuite.testSuite-meta.xml`, `MySuite.testSuite`
**Postconditions:** Chỉ `-meta.xml` được nhận diện.

---

### TC-027: Regression — `.cls` → `apex` (giữ nguyên)

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-027 |
| **Độ ưu tiên** | High |
| **Loại** | Regression |
| **Requirement** | Story 6 / AC6 / BR-15 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Gọi `detectLanguage('MyClass.cls')` | Trả `'apex'` (không đổi) |

**Test Data:** `MyClass.cls`

---

### TC-028: Regression — `.trigger` → `apex` (giữ nguyên)

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-028 |
| **Độ ưu tiên** | High |
| **Loại** | Regression |
| **Requirement** | Story 6 / AC6 / BR-15 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Gọi `detectLanguage('MyTrig.trigger')` | Trả `'apex'` |

**Test Data:** `MyTrig.trigger`

---

### TC-029: Regression — `.pega` → `pega` (giữ nguyên)

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-029 |
| **Độ ưu tiên** | High |
| **Loại** | Regression |
| **Requirement** | Story 6 / AC6 / BR-15 / BR-6 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Gọi `detectLanguage('rule.pega')` | Trả `'pega'` |

**Test Data:** `rule.pega`

---

### TC-030: Exception — extension không khớp → `null` (EF-1)

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-030 |
| **Độ ưu tiên** | High |
| **Loại** | Functional — Exception Flow |
| **Requirement** | UC-01 EF-1 / BR-4 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Gọi `detectLanguage('README.md')` | Trả `null` (không throw) |
| 2 | Gọi `detectLanguage('notes.txt')` | Trả `null` |

**Test Data:** `README.md`, `notes.txt`
**Postconditions:** Hệ thống ổn định, không ném lỗi.

---

## 2. Unit Test — Gate 2 (`includeExtensions`) cả 2 scanner (AC2 / UC-02)

### TC-031: Gate 2 sync scanner — extension mới qua `processFile`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-031 |
| **Độ ưu tiên** | High |
| **Loại** | Functional — Happy Path |
| **Requirement** | Story 2 / AC2 / UC-02 / BR-5 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Cấu hình `includeExtensions` chứa `.page`, `.apex`, `.cmp`, `.component`, `.app`, `.evt`, `.intf`, `.tokens`, `.soql` | — |
| 2 | Gọi `processFile('x/MyPage.page', 'x/MyPage.page', config)` | Trả `ScannedFile` (không `null`) |
| 3 | Gọi `processFile('x/q.soql', ...)` | Trả `ScannedFile` |

**Test Data:** `MyPage.page`, `q.soql` (có trong `DEFAULT_EXTENSIONS`)
**Postconditions:** Simple extension vượt Gate 2 ở scanner sync.

---

### TC-032: Gate 2 async scanner — extension mới qua `scanWorkspaceAsync`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-032 |
| **Độ ưu tiên** | High |
| **Loại** | Functional — Happy Path |
| **Requirement** | Story 2 / AC2 / UC-02 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Gọi `scanWorkspaceAsync` trên workspace chứa `MyPage.page` + `MyCmp.cmp` | Cả 2 tệp được đưa vào danh sách quét (không skip) |

**Test Data:** Workspace SFDX mẫu với `.page`, `.cmp`
**Postconditions:** Async scanner dùng chung `detectLanguage` → qua Gate 2 (BRD §2.3, TDD §3.1.3).

---

### TC-033: Gate 2 — compound `.xml` miễn trừ qua `language === 'salesforce-meta'`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-033 |
| **Độ ưu tiên** | High |
| **Loại** | Functional — Happy Path |
| **Requirement** | Story 2 / AC2 / UC-02 / TDD §3.1.3 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | `ext = '.xml'` (không trong `includeExtensions`), nhưng `language === 'salesforce-meta'` | Gate 2 cho qua (`ext !== '.kts' && language === 'salesforce-meta'`) |
| 2 | Gọi `processFile('x/My.layout-meta.xml', ...)` | Trả `ScannedFile` dù `.xml` không nằm trong include |

**Test Data:** `My.layout-meta.xml`
**Postconditions:** Compound-suffix KHÔNG cần thêm vào `includeExtensions`.

---

### TC-034: Regression Gate 2 — `.cls`/`.trigger`/`.pega` vẫn qua

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-034 |
| **Độ ưu tiên** | High |
| **Loại** | Regression |
| **Requirement** | Story 6 / AC6 / BR-6 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | `processFile('x/A.cls', ...)` | Trả `ScannedFile` |
| 2 | `processFile('x/T.trigger', ...)` | Trả `ScannedFile` |
| 3 | `processFile('x/R.pega', ...)` | Trả `ScannedFile` |

**Test Data:** `A.cls`, `T.trigger`, `R.pega`

---

## 3. Unit Test — `grammar-config.json` parser selection (AC3 / UC-03)

### TC-035: grammar-config chọn `apex` parser cho `.cls`/`.trigger`/`.apex`/`.soql`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-035 |
| **Độ ưu tiên** | High |
| **Loại** | Functional — Happy Path |
| **Requirement** | Story 3 / AC3 / BR-7 / BR-9 (FSD §3.3b) |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Tra `grammar-config.json` entry `apex.extensions` | Chứa `.cls`, `.trigger`, `.apex`, `.soql` |
| 2 | `getLanguageId('X.apex')` → `apex` | `parserModule = './languages/apex-parser.js'`, `wasmPath = 'grammars/tree-sitter-apex.wasm'` |

**Test Data:** `X.apex`
**Postconditions:** Ánh xạ nhất quán với §3.1.

---

### TC-036: grammar-config chọn `salesforce-meta` cho 17 compound suffixes

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-036 |
| **Độ ưu tiên** | High |
| **Loại** | Functional — Happy Path |
| **Requirement** | Story 3 / AC3 / BR-7 / FSD §3.3a |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Với mỗi suffix trong 17 danh sách → `getLanguageId` | Trả `'salesforce-meta'`, `parserModule = './languages/salesforce-meta-parser.js'`, `wasmPath = null` |

**Test Data:** 17 tệp `*-meta.xml` mẫu
**Postconditions:** Mọi compound nhận đúng parser.

---

### TC-037: grammar-config chọn `visualforce` parser cho `.page`/`.component`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-037 |
| **Độ ưu tiên** | High |
| **Loại** | Functional — Happy Path |
| **Requirement** | Story 3 / AC3 / BR-7 / BR-8 (FSD §3.3c) |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | `getLanguageId('X.page')` | `'visualforce'`, `wasmPath = null`, `parserModule = './languages/visualforce-parser.js'` |
| 2 | `getLanguageId('X.component')` | `'visualforce'` |

**Test Data:** `X.page`, `X.component`

---

### TC-038: grammar-config chọn `aura` parser cho `.cmp`/`.app`/`.evt`/`.intf`/`.tokens`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-038 |
| **Độ ưu tiên** | High |
| **Loại** | Functional — Happy Path |
| **Requirement** | Story 3 / AC3 / BR-7 / BR-8 (FSD §3.3d) |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | `getLanguageId('X.cmp')` | `'aura'`, `wasmPath = null` |
| 2 | Tương tự `.app`, `.evt`, `.intf`, `.tokens` | `'aura'` |

**Test Data:** `X.cmp`, `X.app`, `X.evt`, `X.intf`, `X.tokens`

---

### TC-039: Mỗi extension gán đúng 1 parser + `wasmPath=null` cho VF/Aura (BR-7, BR-8)

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-039 |
| **Độ ưu tiên** | High |
| **Loại** | Business Rule Validation |
| **Requirement** | BR-7, BR-8, BR-9 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Quét `grammar-config.json`, đảm bảo không có extension xuất hiện ở 2 entry khác nhau | Không trùng (BR-7) |
| 2 | Kiểm tra `visualforce.wasmPath === null` và `aura.wasmPath === null` | Đúng (BR-8) |

**Test Data:** N/A (static config assertion)
**Postconditions:** Không mâu thuẫn ánh xạ.

---

### TC-040: Exception — extension không có parser → null (graceful)

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-040 |
| **Độ ưu tiên** | Medium |
| **Loại** | Functional — Exception Flow |
| **Requirement** | Story 3 / AC3 / BR-9 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | `getLanguageId('x.unknown')` | Trả `null` (không throw), scanner sẽ skip |

**Test Data:** `x.unknown`

---

## 4. Unit Test — `module-helper.ts` `detectModule` mapping (AC4 / UC-04)

> Mỗi test case: input path SFDX → module kỳ vọng. Bảng ánh xạ theo FSD §3.4.1 / TDD §3.4.

### TC-041: `.page` → `visualforce-pages`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-041 |
| **Độ ưu tiên** | High |
| **Loại** | Functional |
| **Requirement** | Story 4 / AC4 / BR-10 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | `detectModule('force-app/main/default/pages/MyPage.page')` | `'visualforce-pages'` |

**Test Data:** `force-app/main/default/pages/MyPage.page`

---

### TC-042: `.component` (VF) → `visualforce-components` (BR-3)

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-042 |
| **Độ ưu tiên** | High |
| **Loại** | Business Rule (BR-3) |
| **Requirement** | Story 4 / AC4 / BR-3 / TR-3 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | `detectModule('force-app/main/default/components/MyComp.component')` | `'visualforce-components'` (KHÔNG `aura-components`) |

**Test Data:** `force-app/main/default/components/MyComp.component`

---

### TC-043: `.cmp`/`.app`/`.evt`/`.intf`/`.tokens` → `aura-components`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-043 |
| **Độ ưu tiên** | High |
| **Loại** | Functional |
| **Requirement** | Story 4 / AC4 / BR-10 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | `detectModule('force-app/main/default/aura/MyCmp.cmp')` | `'aura-components'` |
| 2 | Tương tự `.app`, `.evt`, `.intf`, `.tokens` trong `/aura/` | `'aura-components'` |

**Test Data:** `force-app/main/default/aura/MyCmp.cmp`

---

### TC-044: `*.layout-meta.xml` → `sf-layouts`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-044 |
| **Độ ưu tiên** | High |
| **Loại** | Functional |
| **Requirement** | Story 4 / AC4 / BR-10 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | `detectModule('force-app/main/default/layouts/X.layout-meta.xml')` | `'sf-layouts'` |

**Test Data:** `force-app/main/default/layouts/X.layout-meta.xml`

---

### TC-045: `*.permissionset-meta.xml` → `sf-permissionsets`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-045 |
| **Độ ưu tiên** | High |
| **Loại** | Functional |
| **Requirement** | Story 4 / AC4 / BR-10 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | `detectModule('force-app/main/default/permissionsets/PS.permissionset-meta.xml')` | `'sf-permissionsets'` |

**Test Data:** `force-app/main/default/permissionsets/PS.permissionset-meta.xml`

---

### TC-046: `*.profile-meta.xml` → `sf-profiles`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-046 |
| **Độ ưu tiên** | High |
| **Loại** | Functional |
| **Requirement** | Story 4 / AC4 / BR-10 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | `detectModule('force-app/main/default/profiles/Admin.profile-meta.xml')` | `'sf-profiles'` |

**Test Data:** `force-app/main/default/profiles/Admin.profile-meta.xml`

---

### TC-047: `*.labels-meta.xml` → `sf-labels`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-047 |
| **Độ ưu tiên** | High |
| **Loại** | Functional |
| **Requirement** | Story 4 / AC4 / BR-10 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | `detectModule('force-app/main/default/labels/Custom.labels-meta.xml')` | `'sf-labels'` |

**Test Data:** `force-app/main/default/labels/Custom.labels-meta.xml`

---

### TC-048: `*.tab-meta.xml` → `sf-tabs`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-048 |
| **Độ ưu tiên** | High |
| **Loại** | Functional |
| **Requirement** | Story 4 / AC4 / BR-10 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | `detectModule('force-app/main/default/tabs/T.tab-meta.xml')` | `'sf-tabs'` |

**Test Data:** `force-app/main/default/tabs/T.tab-meta.xml`

---

### TC-049: `*.flexipage-meta.xml` → `sf-flexipages`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-049 |
| **Độ ưu tiên** | High |
| **Loại** | Functional |
| **Requirement** | Story 4 / AC4 / BR-10 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | `detectModule('force-app/main/default/flexipages/H.flexipage-meta.xml')` | `'sf-flexipages'` |

**Test Data:** `force-app/main/default/flexipages/H.flexipage-meta.xml`

---

### TC-050: `*.report-meta.xml` → `sf-reports`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-050 |
| **Độ ưu tiên** | High |
| **Loại** | Functional |
| **Requirement** | Story 4 / AC4 / BR-10 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | `detectModule('force-app/main/default/reports/R.report-meta.xml')` | `'sf-reports'` |

**Test Data:** `force-app/main/default/reports/R.report-meta.xml`

---

### TC-051: `*.dashboard-meta.xml` → `sf-dashboards`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-051 |
| **Độ ưu tiên** | High |
| **Loại** | Functional |
| **Requirement** | Story 4 / AC4 / BR-10 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | `detectModule('force-app/main/default/dashboards/D.dashboard-meta.xml')` | `'sf-dashboards'` |

**Test Data:** `force-app/main/default/dashboards/D.dashboard-meta.xml`

---

### TC-052: `*.site-meta.xml` → `sf-sites`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-052 |
| **Độ ưu tiên** | High |
| **Loại** | Functional |
| **Requirement** | Story 4 / AC4 / BR-10 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | `detectModule('force-app/main/default/sites/S.site-meta.xml')` | `'sf-sites'` |

**Test Data:** `force-app/main/default/sites/S.site-meta.xml`

---

### TC-053: `*.resource-meta.xml` → `sf-staticresources`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-053 |
| **Độ ưu tiên** | High |
| **Loại** | Functional |
| **Requirement** | Story 4 / AC4 / BR-10 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | `detectModule('force-app/main/default/staticresources/logo.resource-meta.xml')` | `'sf-staticresources'` |

**Test Data:** `force-app/main/default/staticresources/logo.resource-meta.xml`

---

### TC-054: `*.email-meta.xml` → `sf-email`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-054 |
| **Độ ưu tiên** | High |
| **Loại** | Functional |
| **Requirement** | Story 4 / AC4 / BR-10 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | `detectModule('force-app/main/default/email/W.email-meta.xml')` | `'sf-email'` |

**Test Data:** `force-app/main/default/email/W.email-meta.xml`

---

### TC-055: `*.testSuite-meta.xml` → `sf-testsuites`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-055 |
| **Độ ưu tiên** | High |
| **Loại** | Functional |
| **Requirement** | Story 4 / AC4 / BR-10 / SA-CONF-3 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | `detectModule('force-app/main/default/testSuites/TS.testSuite-meta.xml')` | `'sf-testsuites'` |

**Test Data:** `force-app/main/default/testSuites/TS.testSuite-meta.xml`

---

### TC-056: Regression — `*.flow/object/field-meta.xml` → module cũ

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-056 |
| **Độ ưu tiên** | High |
| **Loại** | Regression |
| **Requirement** | Story 6 / AC6 / BR-15 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | `detectModule('force-app/main/default/flows/F.flow-meta.xml')` | `'sf-flows'` |
| 2 | `detectModule('force-app/main/default/objects/Acc.object-meta.xml')` | `'sf-objects'` |
| 3 | `detectModule('force-app/main/default/objects/Acc/fields/F.field-meta.xml')` | `'sf-objects'` (parent) |

**Test Data:** paths trên

---

### TC-057: Unknown segment → `salesforce` (default, không đếm trùng BR-11)

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-057 |
| **Độ ưu tiên** | High |
| **Loại** | Functional — Exception |
| **Requirement** | Story 4 / AC4 / BR-11 / TR-4 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | `detectModule('force-app/main/default/unknown/X.xyz')` | `'salesforce'` (default) |
| 2 | Quét 2 tệp cùng path → chỉ đếm 1 (dedupe) | Không đếm trùng |

**Test Data:** `force-app/main/default/unknown/X.xyz`

---

## 5. Unit Test — Sub-parser `salesforce-meta` (AC5 / UC-05)

### TC-058: `parseFlexipage` → ≥1 top-level `class` symbol

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-058 |
| **Độ ưu tiên** | High |
| **Loại** | Functional |
| **Requirement** | Story 5 / AC5 / BR-13 / FSD §3.5.1c |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | `parse('...', 'Home.flexipage-meta.xml')` | `symbols` chứa 1 entry `kind='class'`, `signature='Flexipage: Home'`, `isExported=true` |

**Test Data:** fixture `Home.flexipage-meta.xml` hợp lệ

---

### TC-059: `parsePermissionset` → `PermissionSet: <name>`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-059 |
| **Độ ưu tiên** | High |
| **Loại** | Functional |
| **Requirement** | Story 5 / AC5 / BR-13 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | `parse('...', 'MyPS.permissionset-meta.xml')` | `symbols[0].signature = 'PermissionSet: MyPS'`, `kind='class'` |

**Test Data:** fixture `MyPS.permissionset-meta.xml`

---

### TC-060: `parseProfile` → `Profile: <name>`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-060 |
| **Độ ưu tiên** | High |
| **Loại** | Functional |
| **Requirement** | Story 5 / AC5 / BR-13 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | `parse('...', 'Admin.profile-meta.xml')` | `symbols[0].signature = 'Profile: Admin'` |

**Test Data:** fixture `Admin.profile-meta.xml`

---

### TC-061: `parseLabels` → `Labels: <name>` (+ optional CustomLabel property)

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-061 |
| **Độ ưu tiên** | High |
| **Loại** | Functional |
| **Requirement** | Story 5 / AC5 / BR-13 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | `parse('...', 'Custom.labels-meta.xml')` | `symbols[0].signature = 'Labels: Custom'`; nếu có `<CustomLabel><fullName>` → thêm `property` (`parentName='Custom'`) |

**Test Data:** fixture `Custom.labels-meta.xml`

---

### TC-062: `parseTab` → `Tab: <name>`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-062 |
| **Độ ưu tiên** | High |
| **Loại** | Functional |
| **Requirement** | Story 5 / AC5 / BR-13 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | `parse('...', 'MyTab.tab-meta.xml')` | `symbols[0].signature = 'Tab: MyTab'` |

**Test Data:** fixture `MyTab.tab-meta.xml`

---

### TC-063: `parseLayout` → `Layout: <name>`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-063 |
| **Độ ưu tiên** | High |
| **Loại** | Functional |
| **Requirement** | Story 5 / AC5 / BR-13 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | `parse('...', 'Acc-Layout.layout-meta.xml')` | `symbols[0].signature = 'Layout: Acc-Layout'` |

**Test Data:** fixture `Acc-Layout.layout-meta.xml`

---

### TC-064: `parseReport` → `Report: <name>`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-064 |
| **Độ ưu tiên** | High |
| **Loại** | Functional |
| **Requirement** | Story 5 / AC5 / BR-13 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | `parse('...', 'MyR.report-meta.xml')` | `symbols[0].signature = 'Report: MyR'` |

**Test Data:** fixture `MyR.report-meta.xml`

---

### TC-065: `parseDashboard` → `Dashboard: <name>`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-065 |
| **Độ ưu tiên** | High |
| **Loại** | Functional |
| **Requirement** | Story 5 / AC5 / BR-13 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | `parse('...', 'MyD.dashboard-meta.xml')` | `symbols[0].signature = 'Dashboard: MyD'` |

**Test Data:** fixture `MyD.dashboard-meta.xml`

---

### TC-066: `parseSite` → `Site: <name>`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-066 |
| **Độ ưu tiên** | High |
| **Loại** | Functional |
| **Requirement** | Story 5 / AC5 / BR-13 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | `parse('...', 'MyS.site-meta.xml')` | `symbols[0].signature = 'Site: MyS'` |

**Test Data:** fixture `MyS.site-meta.xml`

---

### TC-067: `parseResource` → `StaticResource: <name>`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-067 |
| **Độ ưu tiên** | High |
| **Loại** | Functional |
| **Requirement** | Story 5 / AC5 / BR-13 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | `parse('...', 'logo.resource-meta.xml')` | `symbols[0].signature = 'StaticResource: logo'` |

**Test Data:** fixture `logo.resource-meta.xml`

---

### TC-068: `parseEmail` → `EmailTemplate: <name>`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-068 |
| **Độ ưu tiên** | High |
| **Loại** | Functional |
| **Requirement** | Story 5 / AC5 / BR-13 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | `parse('...', 'Welcome.email-meta.xml')` | `symbols[0].signature = 'EmailTemplate: Welcome'` |

**Test Data:** fixture `Welcome.email-meta.xml`

---

### TC-069: `parseTestSuite` → `TestSuite: <name>`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-069 |
| **Độ ưu tiên** | High |
| **Loại** | Functional |
| **Requirement** | Story 5 / AC5 / BR-13 / SA-CONF-3 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | `parse('...', 'TS.testSuite-meta.xml')` | `symbols[0].signature = 'TestSuite: TS'` |

**Test Data:** fixture `TS.testSuite-meta.xml`

---

### TC-070: Regression — 5 meta type cũ vẫn parse đúng

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-070 |
| **Độ ưu tiên** | High |
| **Loại** | Regression |
| **Requirement** | Story 6 / AC6 / BR-15 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | `parseFlow('...', 'F.flow-meta.xml')` | ≥1 symbol, không throw |
| 2 | `parseObject` / `parseField` / `parseLWCMeta` (js-meta) / `parseAuraMeta` (component-meta) | Mỗi hàm trả ≥1 symbol hợp lệ |

**Test Data:** fixtures hiện có (flow/object/field/js/component)
**Postconditions:** Không hồi quy sub-parser cũ.

---

### TC-071: `getSupportedExtensions()` trả 17 extension (BR-12)

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-071 |
| **Độ ưu tiên** | High |
| **Loại** | Business Rule |
| **Requirement** | BR-12 / FSD §3.5.1b / TDD §3.5.2 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Gọi `getSupportedExtensions()` | Mảng có đúng 17 entry khớp §3.1.1(b) + §3.3(a) |

**Test Data:** N/A
**Postconditions:** Danh sách đồng bộ với grammar-config & detectLanguage.

---

### TC-072: Symbol top-level `kind='class'` + `name` từ path (BR-13)

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-072 |
| **Độ ưu tiên** | High |
| **Loại** | Business Rule |
| **Requirement** | BR-13 / SA-CONF-2 (canonical `ExtractedSymbol`) |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Parse bất kỳ meta type → kiểm tra `symbol.kind === 'class'` | Đúng |
| 2 | `nameFromPath('Acc-Layout.layout-meta.xml')` | Trả `'Acc-Layout'` (regex strip đủ 17 suffix) |

**Test Data:** fixtures
**Postconditions:** Symbol tuân thủ canonical interface (`../types.js`).

---

## 6. Graceful Degradation — XML lỗi (AC5 / BR-14 / SA-CONF-5)

### TC-073: Malformed XML → không throw, log warning, continue

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-073 |
| **Độ ưu tiên** | High |
| **Loại** | Functional — Exception Flow |
| **Requirement** | Story 5 / AC5 / BR-14 / UC-05 EF-1 / SA-CONF-5 (Level 2) |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | `parse('<broken><unclosed>', 'X.layout-meta.xml')` | Hàm TRẢ VỀ (không ném); `errors` có ≥1 entry; `symbols` có thể rỗng; tiến trình index tiếp tục |

**Test Data:** `<broken><unclosed>` (malformed)
**Postconditions:** 1 tệp lỗi KHÔNG crash scan; per-case try/catch ghi `ParseError`.

---

### TC-074: Empty file → `errors.length === 0`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-074 |
| **Độ ưu tiên** | Medium |
| **Loại** | Boundary / Negative |
| **Requirement** | TDD §11.2 TC-09b / BR-14 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | `parse('', 'X.labels-meta.xml')` | `errors.length === 0`, `symbols` rỗng (regex non-throwing) |

**Test Data:** `''` (empty)

---

### TC-075: File isolation — 1 tệp lỗi không ảnh hưởng tệp khác (Level 1)

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-075 |
| **Độ ưu tiên** | High |
| **Loại** | Integration — Error Isolation |
| **Requirement** | SA-CONF-5 (Level 1) / BR-14 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Chạy `indexing-engine.indexSingleFile` trên 1 tệp malformed | `.catch()` bắt lỗi; tệp khác vẫn được index bình thường |

**Test Data:** 1 malformed + 1 valid trong batch
**Postconditions:** Toàn bộ scan không dừng.

---

## 7. Unit Test — VF/Aura Parser (mới, SA-CONF-1)

### TC-076: VisualforceParser `.page` `<apex:page controller="MyCtrl">` → symbol + relationship

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-076 |
| **Độ ưu tiên** | High |
| **Loại** | Functional |
| **Requirement** | Story 5 / AC5 / SA-CONF-1 / FSD §3.8.7 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Parse `<apex:page controller="MyCtrl">` (file `MyPage.page`) | `symbols[0].signature='VisualforcePage: MyPage'`, `modifiers=['visualforce','page']`; `relationships` có `uses → MyCtrl` |

**Test Data:** `<apex:page controller="MyCtrl"></apex:page>`

---

### TC-077: VisualforceParser `.component` → `VisualforceComponent: <base>`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-077 |
| **Độ ưu tiên** | High |
| **Loại** | Functional |
| **Requirement** | Story 5 / AC5 / SA-CONF-1 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Parse `<apex:component>` (file `MyComp.component`) | `signature='VisualforceComponent: MyComp'`, `modifiers=['visualforce','component']` |

**Test Data:** `MyComp.component`

---

### TC-078: VisualforceParser markup nhiều dòng / attr xuống dòng → vẫn lấy symbol (TR-1)

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-078 |
| **Độ ưu tiên** | Medium |
| **Loại** | Boundary / Negative (robustness) |
| **Requirement** | TR-1 / SA-CONF-1 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Parse `<apex:page\n  controller="MyCtrl"\n>` (attr xuống dòng) | Regex `[\s\S]` vẫn lấy được symbol từ path |

**Test Data:** multi-line markup
**Postconditions:** Tên symbol luôn từ path (best-effort relationship).

---

### TC-079: AuraParser `<aura:component implements="...">` → relationship `implements`

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-079 |
| **Độ ưu tiên** | High |
| **Loại** | Functional |
| **Requirement** | Story 5 / AC5 / SA-CONF-1 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Parse `<aura:component implements="c:MyIface">` (file `MyCmp.cmp`) | `signature='AuraComponent: MyCmp'`; `relationships` có `implements → c:MyIface` |

**Test Data:** `MyCmp.cmp`

---

### TC-080: AuraParser `.app`/`.evt`/`.intf`/`.tokens` → prefix tương ứng

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-080 |
| **Độ ưu tiên** | High |
| **Loại** | Functional |
| **Requirement** | Story 5 / AC5 / SA-CONF-1 / FSD §3.8.7 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | `.app` → `AuraApplication:`; `.evt` → `AuraEvent:`; `.intf` → `AuraInterface:`; `.tokens` → `AuraTokens:` | Mỗi loại trả đúng `signature` prefix |

**Test Data:** fixtures `.app`, `.evt`, `.intf`, `.tokens`

---

### TC-081: VF/Aura tệp rỗng / không phải markup → không crash, symbols rỗng

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-081 |
| **Độ ưu tiên** | Medium |
| **Loại** | Boundary / Negative |
| **Requirement** | SA-CONF-1 / BR-14 (best-effort) |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Parse tệp rỗng hoặc không có root tag VF/Aura | `symbols=[]`, `errors=[]`, không throw |

**Test Data:** `''` hoặc `plain text`

---

## 8. Security Test Cases (3 Medium findings)

### TC-ReDoS: Seed regex / detectLanguage an toàn với input thù địch (không ReDoS)

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-ReDoS |
| **Độ ưu tiên** | High |
| **Loại** | Non-Functional — Security |
| **Requirement** | Security Review finding #1 (Medium) / TDD §7 (static suffix match) |

**Preconditions:** Đã implement `detectLanguage` dùng `endsWith` (static suffix) và `nameFromPath` dùng regex tĩnh (không user-input).

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Gọi `detectLanguage` với chuỗi rất dài (≥100k ký tự) kết thúc bằng suffix hợp lệ (`....layout-meta.xml`) | Trả về trong thời gian tức thì (<10ms), KHÔNG treo (no catastrophic backtracking) |
| 2 | Gọi `nameFromPath` với chuỗi dài + suffix | Regex `META_SUFFIX_RE` (static alternation, không lồng/group lặp) hoàn thành nhanh, không ReDoS |
| 3 | Đo thời gian thực thi với input thù địch lặp lại 1000 lần | p95 < 10ms (TDD §8), không stack overflow |

**Test Data:** `A`.repeat(100000) + `.layout-meta.xml`
**Postconditions:** Không có regex user-controlled → không có vector ReDoS. Lỗi bảo mật được ngăn chặn.

---

### TC-Secret-Allowlist: Indexer KHÔNG index nội dung secret (vd `<password>`), log không chứa raw XML

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-Secret-Allowlist |
| **Độ ưu tiên** | High |
| **Loại** | Non-Functional — Security |
| **Requirement** | Security Review finding #2 (Medium) / TDD §7 (log hygiene, no raw XML in logs) |

**Preconditions:** Đã implement log guard — sub-parser chỉ log `filePath`, `metaType`, `error` (KHÔNG raw XML). Index DB chỉ lưu metadata symbol, không lưu nội dung tệp.

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Tạo tệp `secret.resource-meta.xml` chứa `<password>SuperSecret123</password>` và `<username>` | — |
| 2 | Chạy index trên tệp này | Symbol được extract (`StaticResource: secret`); nội dung `<password>` KHÔNG được lưu vào `symbols`/`files` |
| 3 | Kiểm tra log đầu ra của `SalesforceMetaParser.parse()` per-case catch | Log CHỈ chứa `{ filePath, metaType, error }`, KHÔNG chứa raw XML / giá trị secret |
| 4 | Truy vấn DB `symbols`/`files` | Không có dòng nào chứa `SuperSecret123` |

**Test Data:** `secret.resource-meta.xml` với `<password>SuperSecret123</password>`
**Postconditions:** Secret không bị lộ qua index DB hay log.

---

### TC-Symlink-Escape: Scanner không thoát khỏi workspace qua symlink (containment)

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-Symlink-Escape |
| **Độ ưu tiên** | High |
| **Loại** | Non-Functional — Security |
| **Requirement** | Security Review finding #3 (Medium) / TDD §7 (input validation, workspace boundary) |

**Preconditions:** Workspace SFDX mẫu có chứa 1 symlink trỏ ra ngoài workspace (vd `/etc/passwd` hoặc thư mục cha).

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Tạo symlink `force-app/main/default/classes/evil.cls` → `/outside/secret.cls` (ngoài workspace) | — |
| 2 | Chạy `scanWorkspace` / `scanSingleFile` trên workspace | Scanner BỎ QUA tệp bên ngoài workspace (resolve realpath, so sánh boundary) — KHÔNG index nội dung tệp ngoài |
| 3 | Kiểm tra `files` table | KHÔNG có entry nào trỏ tới đường dẫn ngoài workspace |

**Test Data:** symlink đến tệp ngoài workspace
**Postconditions:** Không có lộ thông tin (path traversal / symlink escape) ra ngoài workspace được index.

---

## 9. AC7 — File size / CI / Branch coverage (Story 6 / AC7)

### TC-082: Mỗi file source mới ≤ 200 dòng (BR-16)

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-082 |
| **Độ ưu tiên** | Medium |
| **Loại** | Non-Functional — Maintainability |
| **Requirement** | Story 6 / AC7 / BR-16 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Chạy script đếm dòng trên các file mới: `visualforce-parser.ts`, `aura-parser.ts`, `salesforce-markup/shared.ts`, `salesforce-meta/parsers/*.ts` | Mọi file ≤ 200 dòng |

**Test Data:** source mới
**Postconditions:** Vi phạm → CI fail (BR-18).

---

### TC-083: Unit test cho từng nhánh parser (BR-17)

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-083 |
| **Độ ưu tiên** | Medium |
| **Loại** | Non-Functional — Testability |
| **Requirement** | Story 6 / AC7 / BR-17 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Đo branch coverage của `SalesforceMetaParser.parse()` switch | Mọi nhánh (flow/object/field/lwc-meta/aura-meta/flexipage/permissionset/profile/labels/tab/layout/report/dashboard/site/resource/email/testSuite) có ≥1 test |

**Test Data:** coverage report
**Postconditions:** 100% nhánh parser có test.

---

### TC-084: CI fail nếu file > 200 dòng hoặc test thất bại (BR-18)

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-084 |
| **Độ ưu tiên** | Medium |
| **Loại** | Non-Functional — CI Gate |
| **Requirement** | Story 6 / AC7 / BR-18 |

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Chạy `vitest` + line-count check trong CI | Nếu bất kỳ test fail HOẶC file mới >200 dòng → CI FAIL (block merge) |

**Test Data:** N/A
**Postconditions:** Đảm bảo AC7 enforced tại gate.

---

## 10. Integration Test — SFDX stats & full pipeline (AC4 / AC5)

### TC-085: Quét dự án SFDX mẫu → `code_index_status` chính xác, không undercount, dedupe

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-085 |
| **Độ ưu tiên** | High |
| **Loại** | Integration |
| **Requirement** | Story 4 / AC4 / BR-11 / TDD §11 (integration) |

**Preconditions:** SQLite test DB khởi tạo; dự án SFDX mẫu có đầy đủ các segment (`pages/`, `components/`, `aura/`, `layouts/`, `permissionsets/`, `profiles/`, `labels/`, `tabs/`, `flexipages/`, `reports/`, `dashboards/`, `sites/`, `staticresources/`, `email/`, `testSuites/`, `flows/`, `objects/`, `classes/`, `triggers/`).

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Chạy index toàn bộ dự án mẫu | `code_index_status.salesforce_files` = tổng số tệp Salesforce; `indexed_files` khớp; mỗi module trong `modules` có `file_count` đúng |
| 2 | Kiểm tra không đếm trùng (2 tệp cùng path) | `file_count` không vượt quá số tệp thực tế |

**Test Data:** Dự án SFDX mẫu (biết trước số lượng)
**Postconditions:** Thống kê SFDX chính xác (khắc phục undercount).

---

### TC-086: Full pipeline — file → Gate1 → Gate2 → parser → detectModule → lưu DB

| Trường | Giá trị |
|--------|---------|
| **ID** | TC-086 |
| **Độ ưu tiên** | High |
| **Loại** | Integration |
| **Requirement** | Story 1–5 / AC1–AC5 / TDD §6.1 |

**Preconditions:** Toàn bộ 5 touchpoint đã implement; SQLite test DB sẵn sàng.

**Các bước:**

| Bước | Hành động | Kết quả kỳ vọng |
|------|-----------|-----------------|
| 1 | Đưa 1 tệp `MyPage.page` vào workspace, chạy index | `files.language='visualforce'`, `files.module='visualforce-pages'`, `symbols` có `VisualforcePage: MyPage` |
| 2 | Đưa 1 tệp `X.layout-meta.xml` | `files.language='salesforce-meta'`, `module='sf-layouts'`, `symbols` có `Layout: X` |
| 3 | Đưa 1 tệp `MyCmp.cmp` | `language='aura'`, `module='aura-components'`, `symbols` có `AuraComponent: MyCmp` |

**Test Data:** 3 tệp đại diện 3 ngôn ngữ mới
**Postconditions:** End-to-end in-process hoạt động đúng cho mọi ngôn ngữ.

---

## 11. Requirements Traceability Matrix (RTM)

| Requirement | Source | Test Cases | Trạng thái |
|-------------|--------|------------|------------|
| UC-01 (detectLanguage) | FSD 3.1 / BRD Story 1 | TC-001–TC-030 | ✅ Covered |
| UC-02 (Gate 2) | FSD 3.2 / BRD Story 2 | TC-031–TC-034 | ✅ Covered |
| UC-03 (grammar-config) | FSD 3.3 / BRD Story 3 | TC-035–TC-040 | ✅ Covered |
| UC-04 (detectModule) | FSD 3.4 / BRD Story 4 | TC-041–TC-057 | ✅ Covered |
| UC-05 (sub-parser + graceful) | FSD 3.5 / BRD Story 5 | TC-058–TC-075 | ✅ Covered |
| BR-1 (language hợp lệ) | FSD 3.1.3 | TC-001–TC-009 | ✅ Covered |
| BR-2 (compound-suffix) | FSD 3.1.3 | TC-010–TC-026 | ✅ Covered |
| BR-3 (.component ≠ component-meta) | FSD 3.1.3 | TC-004, TC-014, TC-042 | ✅ Covered |
| BR-4 (không extension nào null) | FSD 3.1.3 | TC-001–TC-030, TC-030 | ✅ Covered |
| BR-5 / BR-6 (includeExtensions / giữ cũ) | FSD 3.2.3 | TC-031–TC-034 | ✅ Covered |
| BR-7 / BR-8 / BR-9 (parser mapping) | FSD 3.3.2 | TC-035–TC-040 | ✅ Covered |
| BR-10 / BR-11 (module + dedupe) | FSD 3.4.2 | TC-041–TC-057 | ✅ Covered |
| BR-12 (getSupportedExtensions) | FSD 3.5.3 | TC-071 | ✅ Covered |
| BR-13 (top-level symbol) | FSD 3.5.3 | TC-058–TC-072 | ✅ Covered |
| BR-14 (graceful degradation) | FSD 3.5.3 | TC-073–TC-075 | ✅ Covered |
| BR-15 (no regression Apex+5) | FSD 3.6 | TC-027–TC-029, TC-070 | ✅ Covered |
| BR-16 (≤200 dòng) | FSD 3.6 | TC-082 | ✅ Covered |
| BR-17 (unit test từng nhánh) | FSD 3.6 | TC-083 | ✅ Covered |
| BR-18 (CI gate) | FSD 3.6 | TC-084 | ✅ Covered |
| AC1 | BRD Story 1 | TC-001–TC-030 | ✅ 100% |
| AC2 | BRD Story 2 | TC-031–TC-034 | ✅ 100% |
| AC3 | BRD Story 3 | TC-035–TC-040 | ✅ 100% |
| AC4 | BRD Story 4 | TC-041–TC-057, TC-085 | ✅ 100% |
| AC5 | BRD Story 5 | TC-058–TC-075 | ✅ 100% |
| AC6 | BRD Story 6 | TC-027–TC-029, TC-070, TC-076–TC-081 | ✅ 100% |
| AC7 | BRD Story 6 | TC-082–TC-084 | ✅ 100% |
| Security #1 ReDoS | Security Review | TC-ReDoS | ✅ Covered |
| Security #2 Secret allowlist | Security Review | TC-Secret-Allowlist | ✅ Covered |
| Security #3 Symlink escape | Security Review | TC-Symlink-Escape | ✅ Covered |

**Coverage Summary:**

| Danh mục | Tổng | Covered | Coverage |
|----------|------|---------|----------|
| Use Cases (UC-01..05) | 5 | 5 | 100% |
| Business Rules (BR-1..18) | 18 | 18 | 100% |
| Acceptance Criteria (AC1..7) | 7 | 7 | 100% |
| Security Findings | 3 | 3 | 100% |
| **Overall** | **33** | **33** | **100%** |

---

## 12. Phụ lục (Appendix)

### A. Test Data Setup (fixtures)

Tạo các fixture sau trong thư mục test (ví dụ `backend/src/engine/parsers/languages/__tests__/fixtures/`):

- `salesforce-meta/` — 17 tệp `*-meta.xml` hợp lệ (mỗi loại ≥1), 1 tệp malformed (`broken.layout-meta.xml` = `<broken><unclosed>`), 1 tệp rỗng.
- `visualforce/` — `MyPage.page` (`<apex:page controller="MyCtrl">`), `MyComp.component` (`<apex:component>`), 1 multi-line, 1 rỗng.
- `aura/` — `MyCmp.cmp` (`<aura:component implements="c:MyIface">`), `.app`/`.evt`/`.intf`/`.tokens` mẫu, 1 rỗng.
- `sfdx-sample/` — dự án SFDX đầy đủ các segment (dùng cho TC-085, TC-086).
- `secret.resource-meta.xml` — chứa `<password>SuperSecret123</password>` (TC-Secret-Allowlist).
- symlink `evil.cls` → tệp ngoài workspace (TC-Symlink-Escape).

### B. Environment Configuration

- `vitest.config.ts` bao gồm `backend/src` với ESM + `tsx`.
- CI: chạy `vitest --run` + script `check-line-count.sh` (BR-18).
- SQLite test DB: `:memory:` hoặc file temp, reset mỗi lần chạy integration.
