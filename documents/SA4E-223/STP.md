# Software Test Plan (STP) — SA4E-223

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
| Tài liệu liên quan | BRD v1.0, FSD v1.1, TDD v1.0 (tại `documents/SA4E-223/`) |

---

## Lịch sử phiên bản (Revision History)

| Phiên bản | Ngày | Tác giả | Thay đổi |
|-----------|------|---------|----------|
| 1.0 | 2026-08-27 | QA Agent | Khởi tạo STP — tự động trích xuất từ BRD, FSD, TDD |

---

## 1. Giới thiệu (Introduction)

### 1.1 Mục đích (Purpose)

Tài liệu này định nghĩa **chiến lược kiểm thử** cho hạng mục bug-fix SA4E-223 trên backend **Code Intelligence Indexer** (TypeScript). Mục tiêu: xác minh indexer nhận diện được **toàn bộ** phần mở rộng Salesforce (Aura/Visualforce, Metadata `*-meta.xml`, Apex-adjacent) qua 2 cổng lọc (Gate 1: `detectLanguage`, Gate 2: `includeExtensions`), chọn đúng parser, ánh xạ đúng module, trích xuất symbol cấp cao nhất, và xử lý XML lỗi an toàn — đồng thời **không hồi quy** Apex và 5 meta type hiện tại.

### 1.2 Mục tiêu kiểm thử (Test Objectives)

- **OBJ-1:** Xác minh `detectLanguage()` trả non-null cho 26 extension mới (9 simple + 17 compound-suffix) — đáp ứng AC1.
- **OBJ-2:** Xác minh mọi extension vượt qua Gate 2 ở **cả hai** scanner (`file-scanner.ts` sync + `async-file-scanner.ts`) — đáp ứng AC2.
- **OBJ-3:** Xác minh `grammar-config.json` chọn đúng parser (apex / salesforce-meta / visualforce / aura) — đáp ứng AC3.
- **OBJ-4:** Xác minh `detectModule` ánh xạ đúng module và thống kê `code_index_status` SFDX chính xác, không đếm trùng — đáp ứng AC4.
- **OBJ-5:** Xác minh sub-parser `salesforce-meta` trích xuất ≥1 top-level symbol mỗi meta type, và XML lỗi → degrade gracefully (không throw) — đáp ứng AC5.
- **OBJ-6:** Xác minh không hồi quy Apex (`.cls`/`.trigger`) + 5 meta type hiện tại (flow/object/field/js/component) — đáp ứng AC6.
- **OBJ-7:** Xác minh mỗi file source mới ≤200 dòng, models tách riêng, có unit test cho từng nhánh parser — đáp ứng AC7.
- **OBJ-8:** Xác minh 3 security findings (ReDoS, secret allowlist, symlink escape) được xử lý đúng.

### 1.3 Tài liệu tham khảo (References)

| Tài liệu | Vị trí |
|----------|--------|
| BRD | `documents/SA4E-223/BRD.md` (v1.0) |
| FSD | `documents/SA4E-223/FSD.md` (v1.1) |
| TDD | `documents/SA4E-223/TDD.md` (v1.0) |
| Security Review | 3 Medium findings → TC-ReDoS, TC-Secret-Allowlist, TC-Symlink-Escape |

---

## 2. Chiến lược kiểm thử (Test Strategy)

### 2.1 Cấp độ kiểm thử (Test Levels)

Đây là backend indexer (không có UI người dùng). Do đó tập trung vào **Unit** và **Integration**; SIT/UAT ở mức manual verification tối thiểu.

| Cấp độ | Phạm vi | Trách nhiệm | Công cụ |
|--------|---------|-------------|---------|
| Unit Testing | Hàm đơn lẻ: `detectLanguage`, `detectModule`, `detectMetaType`, sub-parsers, `nameFromPath`, `extractMarkupTopLevel` | DEV + QA | vitest (TypeScript) |
| Integration Testing | Luồng end-to-end in-process: file → Gate1 → Gate2 → parser → detectModule → lưu SQLite (`files`/`symbols`/`modules`/`code_index_status`) | QA | vitest + SQLite in-memory / test DB |
| System Testing (SIT) | Quét toàn bộ dự án SFDX mẫu, kiểm tra thống kê `code_index_status` | QA | Manual / scripted |
| Security Testing | ReDoS, secret allowlist, symlink escape | QA | vitest + filesystem harness |

### 2.2 Loại kiểm thử (Test Types)

| Loại | Mô tả | Áp dụng |
|------|-------|---------|
| Functional Testing | Xác minh từng UC/BR theo FSD | Có |
| Regression Testing | Không hồi quy Apex + 5 meta type, parser cũ | Có |
| Integration Testing | Luồng index đầy đủ, lưu DB | Có |
| Security Testing | 3 findings Medium | Có |
| Performance Testing | p95 < 10ms/tệp (target TDD §8) | Có (lightweight) |
| Usability / Compatibility | Không áp dụng (backend, không UI) | Không |

### 2.3 Phương pháp tiếp cận (Test Approach)

- **Automated-first:** 100% test case thực thi bởi vitest (Unit + Integration). Không có manual SIT bắt buộc ngoài quét dự án mẫu xác nhận thống kê.
- **Risk-based prioritization:** Đặc quyền High cho các test case ánh xạ trực tiếp 7 AC (OBJ-1..OBJ-7) và 3 security findings.
- **Single-source-of-truth:** Test dùng chung fixture SFDX mẫu; mọi extension được cover qua data-driven test (loop qua danh sách 26 extension).
- **Branch coverage:** Mỗi nhánh `switch` trong `SalesforceMetaParser.parse()` có ít nhất 1 test (BR-17).

### 2.4 Tiêu chí vào (Entry Criteria)

| Cấp độ | Tiêu chí vào |
|--------|--------------|
| Unit | Code của 5 touchpoint đã implement; `vitest` cấu hình chạy được; fixtures SFDX mẫu sẵn sàng |
| Integration | Unit tests pass; SQLite test DB có thể khởi tạo; `code_index_status` schema sẵn sàng |
| Security | 3 fix tương ứng (regex static, log guard, symlink guard) đã implement |

### 2.5 Tiêu chí ra (Exit Criteria)

| Cấp độ | Tiêu chí ra |
|--------|-------------|
| Unit + Integration | 100% test cases thực thi; 0 failed; coverage ≥ yêu cầu BR-17 (mọi nhánh parser) |
| Security | 3 security test case pass (TC-ReDoS, TC-Secret-Allowlist, TC-Symlink-Escape) |
| Release gate | CI không fail (BR-18: mọi file mới ≤200 dòng + test pass) |

---

## 3. Phạm vi kiểm thử (Test Scope)

### 3.1 Tính năng trong phạm vi (In Scope)

| # | Tính năng / Story | Độ ưu tiên | Tham chiếu FSD | Loại test |
|---|-------------------|------------|----------------|-----------|
| 1 | `detectLanguage` nhận diện 26 extension mới (9 simple + 17 compound) | High | Story 1 / AC1 / UC-01 | Unit |
| 2 | Gate 2 (`includeExtensions`) cả 2 scanner | High | Story 2 / AC2 / UC-02 | Unit + Integration |
| 3 | `grammar-config.json` chọn đúng parser | High | Story 3 / AC3 / UC-03 | Unit |
| 4 | `detectModule` ánh xạ module + SFDX stats | High | Story 4 / AC4 / UC-04 | Unit + Integration |
| 5 | Sub-parser `salesforce-meta` extract symbol + graceful degradation | High | Story 5 / AC5 / UC-05 | Unit |
| 6 | Không hồi quy Apex + 5 meta type + parser VF/Aura | High | Story 6 / AC6 / AC7 | Unit + Regression |
| 7 | `getSupportedExtensions` trả 17 extension | High | BR-12 | Unit |
| 8 | Security: ReDoS, secret allowlist, symlink escape | High | Security Review (3 Medium) | Security |
| 9 | Quét dự án SFDX mẫu → `code_index_status` chính xác | High | AC4 | Integration |

### 3.2 Tính năng ngoài phạm vi (Out of Scope)

| # | Tính năng | Lý do |
|---|-----------|-------|
| 1 | Deep semantic parsing cho Salesforce | Ngoài scope BRD §1.2 / FSD §1.2 |
| 2 | Xây dựng tree-sitter grammar cho Visualforce/Aura | Dùng regex/generic, `wasmPath=null` (SA-CONF-1) |
| 3 | Thay đổi schema lưu trữ / giao diện người dùng | Không đổi schema DB (TDD §4) |
| 4 | Unify legacy `signature-extractor.ts` | Follow-up, out of scope (SA-CONF-2) |
| 5 | DISC-1 (bổ sung `.cls/.trigger/.pega` vào `FALLBACK_EXTENSIONS`) | Pre-existing, đề xuất Low, không bắt buộc |

---

## 4. Môi trường kiểm thử (Test Environment)

### 4.1 Yêu cầu môi trường

| Thành phần | Mô tả |
|------------|-------|
| OS | Windows / Linux (môi trường CI chạy Node.js) |
| Runtime | Node.js (ESM, `.js` import specifiers) + `tsx` để chạy TypeScript |
| Test framework | vitest |
| Database | SQLite in-memory hoặc file test (`DatabaseAdapter`) |
| Codebase | `backend/src/engine/indexer/`, `backend/src/config/`, `backend/src/engine/parsers/` |

### 4.2 Yêu cầu trình duyệt / thiết bị

Không áp dụng (backend, không UI).

### 4.3 Yêu cầu dữ liệu kiểm thử (Test Data)

| Loại dữ liệu | Mô tả | Chuẩn bị |
|--------------|-------|----------|
| Fixture extension | 26 tệp Salesforce mẫu (mỗi extension ≥1 tệp hợp lệ) | Tạo trong `fixtures/salesforce-meta/`, `fixtures/visualforce/`, `fixtures/aura/` |
| Fixture malformed XML | Tệp `*.layout-meta.xml` hỏng (`<broken><unclosed>`) | Tạo thủ công |
| Fixture SFDX mẫu | Dự án SFDX có cấu trúc `force-app/` đầy đủ các segment | Tạo cây thư mục mẫu |
| Fixture symlink | Symlink trỏ ra ngoài workspace | Tạo trong test harness (temp dir) |

### 4.4 Phụ thuộc ngoài

| Hệ thống | Phụ thuộc | Mock/Stub |
|----------|-----------|-----------|
| Không có | Toàn bộ in-process, không external system | N/A (dùng SQLite test DB) |

---

## 5. Lịch trình kiểm thử (Test Schedule)

| Giai đoạn | Thời gian (ước tính) | Milestone |
|-----------|----------------------|-----------|
| Test Planning (STP + STC) | 0.5 ngày | STP + STC approved |
| Test Data Preparation (fixtures) | 0.5 ngày | Fixtures sẵn sàng |
| Unit + Integration Execution | 1–2 ngày | 100% test pass |
| Security Test Execution | 0.5 ngày | 3 security findings pass |
| Defect Fix & Retest | theo dev | 0 Critical/Major open |
| CI Gate (BR-18) | tích hợp CI | Merge allowed |

---

## 6. Nguồn lực & Trách nhiệm (Resources & Responsibilities)

| Vai trò | Trách nhiệm |
|---------|-------------|
| QA Engineer (QA Agent) | Thiết kế STP/STC, viết & thực thi test case, báo cáo defect |
| DEV Agent | Implement 5 touchpoint, viết unit test, fix defect |
| SA Agent | Xác nhận design (5 SA-CONF đã chốt), hỗ trợ review |
| BA Agent | Hỗ trợ làm rõ acceptance criteria |
| DevOps Agent | Setup CI gate (BR-18: line-count + test), môi trường chạy test |
| SM Agent | Điều phối, chuyển Phase 4.5 (CI/CD) |

---

## 7. Rủi ro & Giảm thiểu (Risk & Mitigation)

| # | Rủi ro | Tác động | Khả năng | Giảm thiểu |
|---|--------|----------|----------|------------|
| 1 | `nameFromPath` chưa cover 12 suffix mới → symbol sai tên | Cao | TB | Centralize suffix (`META_SUFFIX_RE`, `SALESFORCE_META_SUFFIXES`); test TC-002/TC-010..TC-026 (TR-2) |
| 2 | Nhầm `.component` (VF) vs `component-meta.xml` (Aura) module | Cao | TB | BR-3; test TC-042 (visualforce-components) vs TC-014 (aura-components) (TR-3) |
| 3 | `detectModule` default nuốt type mới | Cao | TB | Thêm segment check trước default; test TC-041..TC-057 (TR-4) |
| 4 | Regex VF/Aura bỏ sót symbol | TB | Cao | Lấy tên từ path; test TC-076..TC-081 (TR-1) |
| 5 | Fixture thiếu cho 12 meta type mới | TB | Cao | Bổ sung fixture hợp lệ mỗi loại (TDD §11.2) |
| 6 | Symlink escape leak ngoài workspace | Cao | Thấp | Test TC-Symlink-Escape; thêm guard trong scanner |

---

## 8. Quản lý lỗi (Defect Management)

### 8.1 Mức độ nghiêm trọng (Severity)

| Mức | Định nghĩa | Ví dụ |
|-----|-----------|-------|
| Critical | Crash tiến trình index, mất dữ liệu, lỗi bảo mật | Symlink escape đọc tệp ngoài workspace; ReDoS làm treo |
| Major | Tính năng không hoạt động dù có workaround | Extension trả null; sai module |
| Minor | Cosmetic / log | Log thừa |
| Trivial | Typo | — |

### 8.2 Mức độ ưu tiên (Priority) & SLA

| Priority | Định nghĩa | SLA |
|----------|-----------|-----|
| P1 | Phải sửa ngay (blocker) | 4 giờ |
| P2 | Phải sửa trước release | 1 ngày làm việc |
| P3 | Nên sửa nếu có thời gian | 3 ngày |
| P4 | Có thể dời | Release sau |

### 8.3 Vòng đời lỗi (Defect Lifecycle)

```
New → Open → In Progress → Fixed → Ready for Retest → Verified → Closed
                                                       → Reopened → In Progress
```

---

## 9. Chỉ số & Báo cáo (Test Metrics & Reporting)

### 9.1 Chỉ số

| Chỉ số | Công thức | Mục tiêu |
|--------|-----------|----------|
| Test Execution Rate | Executed / Total × 100% | 100% |
| Pass Rate | Passed / Executed × 100% | ≥ 95% |
| Defect Density | Defects / Test Cases | ≤ 0.1 |
| Critical Defect Count | Số defect mức Critical | 0 |
| Branch Coverage (parser) | Nhánh có test / tổng nhánh | 100% (BR-17) |

### 9.2 Lịch báo cáo

| Báo cáo | Tần suất | Đối tượng |
|---------|----------|-----------|
| Test Status (vitest output) | Mỗi lần chạy CI | Team |
| Defect Summary | Khi có defect | Dev + SM |
| Test Completion Report | Cuối phase | All stakeholders |

---

## 10. Ma trận bao phủ 7 Acceptance Criteria (Coverage Matrix)

> Ánh xạ 7 AC của BRD → test cases. Mọi AC đều có coverage 100%.

| AC | Mô tả (nguồn BRD) | Test Cases tương ứng | Coverage |
|----|-------------------|----------------------|----------|
| **AC1** | `detectLanguage()` trả non-null cho toàn bộ extension (Story 1) | TC-001–TC-030 | ✅ 100% |
| **AC2** | Mọi extension vượt Gate 2 ở cả 2 scanner (Story 2) | TC-031–TC-034 | ✅ 100% |
| **AC3** | `grammar-config.json` chọn đúng parser (Story 3) | TC-035–TC-040 | ✅ 100% |
| **AC4** | `detectModule` ánh xạ đúng module + SFDX stats chính xác (Story 4) | TC-041–TC-057, TC-085 | ✅ 100% |
| **AC5** | Sub-parser extract top-level symbol + XML lỗi degrade gracefully (Story 5) | TC-058–TC-075 | ✅ 100% |
| **AC6** | Không hồi quy Apex + 5 meta type hiện tại (Story 6) | TC-027, TC-028, TC-029, TC-070, TC-076–TC-081 | ✅ 100% |
| **AC7** | Mỗi file ≤200 dòng + unit test từng nhánh parser (Story 6) | TC-082, TC-083, TC-084 | ✅ 100% |

**Security findings (3 Medium):** TC-ReDoS, TC-Secret-Allowlist, TC-Symlink-Escape.

---

## 11. Phụ lục (Appendix)

### Glossary

| Thuật ngữ | Định nghĩa |
|-----------|------------|
| SFDX | Salesforce DX — định dạng dự án Salesforce |
| salesforce-meta | Ngôn ngữ nội bộ cho `*-meta.xml` |
| Gate 1 / Gate 2 | `detectLanguage` null-check / `includeExtensions` check |
| code_index_status | Bảng thống kê trạng thái lập chỉ mục |
| Compound-suffix | `<type>-meta.xml` |
| wasmPath = null | Parser regex/generic, không tree-sitter |

### Giả định (Assumptions)

- 5 touchpoint được implement đồng bộ (BRD §2.3 Note).
- Fixtures SFDX mẫu được tạo đủ để cover mọi extension.
- CI đã cấu hình vitest + line-count check (BR-18).
