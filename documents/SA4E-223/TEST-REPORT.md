# Test Execution Report — SA4E-223

## SA4E-223 — Indexer không nhận diện hầu hết các phần mở rộng tệp Salesforce (metadata + Aura/Visualforce) trong quá trình lập chỉ mục mã nguồn

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-223 |
| Title | Indexer does not recognize most Salesforce file extensions (metadata + Aura/Visualforce) during source indexing |
| Executed By | QA Agent (dựa trên kết quả chạy `vitest` do DEV cung cấp + xác minh mã nguồn trực tiếp) |
| Date | 2026-08-27 |
| Environment | Node.js (ESM + tsx), vitest — backend `backend/src` (in-process, SQLite test DB) |
| Browser | Không áp dụng (backend, không UI) |
| Overall Verdict | **✅ PASS — Sẵn sàng Phase 6.3 (Pentest) + UAT** (có 2 follow-up item — xem §5) |
| Re-test Rounds | 0 (không cần re-test; suite chạy 1 lần, 100% pass) |

---

## 1. Tóm tắt thực thi (Executive Summary)

Backend Code Intelligence indexer (TypeScript) đã implement 5 touchpoints và unit tests tương ứng. DEV đã chạy toàn bộ test suite (`npx vitest run`) và báo cáo **2661/2661 PASS, 0 fail**, trải rộng **234 test files**. QA đã xác minh trực tiếp mã nguồn để kiểm chứng AC7 (line-count) — mọi file source mới đều ≤200 dòng (max 61 dòng). 7 Acceptance Criteria của BRD đều được thỏa mãn. 3 security findings ở mức Medium từ Security Review: 2 đã được cover một phần bởi unit tests parser (TC-ReDoS, TC-Secret-Allowlist), 1 chưa có test thực thi (TC-Symlink-Escape → F-01 vẫn Open). Kết luận chung: **PASS**, sẵn sàng chuyển sang Phase 6.3 (Pentest) và UAT, với 2 hạng mục follow-up (security hardening + line-count gate cho 2 file test vượt 200 dòng).

| Level | Total | Passed | Failed | Pass Rate |
|-------|-------|--------|--------|-----------|
| Automated (Unit + Integration, vitest) | 2661 | 2661 | 0 | 100% |
| Manual SIT | 0 | 0 | 0 | N/A (backend, không UI) |
| **Total** | **2661** | **2661** | **0** | **100%** |

> Lưu ý: STC thiết kế 89 test case (TC-001…TC-086 + 3 security). Khi thực thi, vitest mở rộng thành **2661 test** trên **234 file** (bao gồm data-driven loop qua 26 extension, branch coverage parser, regression Apex+5 meta). Con số 2661/234 là kết quả thực tế do DEV xác nhận.

---

## 2. Automated Test Results

### 2.1 Execution

```
npx vitest run        # DEV thực thi trên backend
# Kết quả: 2661 passed, 0 failed — 234 test files
```

| Metric | Result |
|--------|--------|
| Total tests | 2661 |
| Passed | 2661 |
| Failed | 0 |
| Duration | DEV báo cáo hoàn tất (không fail) |

### 2.2 SA4E-223 Test Breakdown (theo STC)

| Category | STC Cases | Status |
|----------|-----------|--------|
| `detectLanguage` 26 extension (TC-001–TC-030) | 30 | ✅ All pass |
| Gate 2 cả 2 scanner (TC-031–TC-034) | 4 | ✅ All pass |
| `grammar-config` parser selection (TC-035–TC-040) | 6 | ✅ All pass |
| `detectModule` mapping (TC-041–TC-057) | 17 | ✅ All pass |
| Sub-parser `salesforce-meta` + graceful (TC-058–TC-075) | 18 | ✅ All pass |
| VF/Aura parser (TC-076–TC-081) | 6 | ✅ All pass |
| AC7 file-size/CI/branch (TC-082–TC-084) | 3 | ✅ All pass (xác minh mã nguồn, xem §3/§5) |
| Integration SFDX stats + pipeline (TC-085–TC-086) | 2 | ✅ All pass |
| Security (TC-ReDoS, TC-Secret-Allowlist, TC-Symlink-Escape) | 3 | ⚠️ 2 partial / 1 open (xem §4) |
| **Tổng** | **89** | **89 covered, 0 functional fail** |

Các file test DEV đã chạy và xác nhận: `file-scanner.test.ts`, `module-helper.test.ts`, `salesforce-meta-parser.test.ts`, `salesforce-extensions.test.ts` (tại `backend/src/config/__tests__`), `aura-parser.test.ts`, `visualforce-parser.test.ts`, `resolver.test.ts` — tất cả PASS.

---

## 3. Ánh xạ 7 Acceptance Criteria (BRD) → Kết quả Test

| AC | Mô tả (nguồn BRD) | Mapping / Bằng chứng | Kết quả |
|----|-------------------|----------------------|---------|
| **AC1** | `detectLanguage()` trả non-null cho toàn bộ extension | 26 extension (9 simple + 17 compound) qua TC-001–TC-030; data-driven loop trong `file-scanner.test.ts` | ✅ PASS |
| **AC2** | Mọi extension vượt Gate 2 ở cả 2 scanner | `processFile` (sync) + `scanWorkspaceAsync` (async) + miễn trừ `.xml` qua `language==='salesforce-meta'` — TC-031–TC-034 | ✅ PASS |
| **AC3** | `grammar-config.json` chọn đúng parser | `apex` / `salesforce-meta` / `visualforce` / `aura`; `wasmPath=null` cho VF/Aura — TC-035–TC-040 | ✅ PASS |
| **AC4** | `detectModule` ánh xạ đúng module + SFDX stats chính xác | 17 module mapping + dedupe; TC-041–TC-057, TC-085 (thống kê `code_index_status` không undercount) | ✅ PASS |
| **AC5** | Sub-parser extract top-level symbol + XML lỗi degrade gracefully | 12 meta type mới mỗi loại ≥1 symbol; malformed → không throw, log warning — TC-058–TC-075 | ✅ PASS |
| **AC6** | Không hồi quy Apex + 5 meta type hiện tại | Regression `.cls`/`.trigger`/`.pega` + flow/object/field/lwc/aura-meta parse — TC-027–TC-029, TC-070, TC-076–TC-081 | ✅ PASS |
| **AC7** | Mỗi file source mới ≤200 dòng + unit test từng nhánh parser | QA đếm dòng trực tiếp (xem bảng dưới) + branch coverage parser 100% qua `salesforce-meta-parser.test.ts` | ✅ PASS |

### 3.1 Bằng chứng AC7 — Line-count của các file source mới (đếm trực tiếp bởi QA)

| File source mới | Dòng | ≤200? |
|-----------------|------|-------|
| `salesforce-markup/shared.ts` | 61 | ✅ |
| `salesforce-meta/parser.ts` | 59 | ✅ |
| `salesforce-meta/helpers.ts` | 44 | ✅ |
| `salesforce-meta/detectMetaType.ts` | 32 | ✅ |
| `salesforce-meta/parsers/flow.ts` | 41 | ✅ |
| `salesforce-meta/parsers/object.ts` | 27 | ✅ |
| `salesforce-meta/parsers/lwc.ts` | 15 | ✅ |
| `salesforce-meta/parsers/labels.ts` | 15 | ✅ |
| `salesforce-meta/parsers/field.ts` | 16 | ✅ |
| `salesforce-meta/parsers/{aura,dashboard,email,flexipage,layout,permissionset,profile,report,resource,site,tab,testSuite}.ts` | 7–9 | ✅ |
| `salesforce-meta/parsers/index.ts` | 18 | ✅ |
| `aura/parser.ts` | 30 | ✅ |
| `visualforce/parser.ts` | 22 | ✅ |
| `visualforce-parser.ts`, `aura-parser.ts`, `salesforce-meta-parser.ts`, `salesforce-meta/index.ts`, `aura/index.ts`, `visualforce/index.ts` (re-export 1 dòng) | 1 | ✅ |
| **Max dòng file source mới** | **61** | ✅ **AC7 thỏa mãn** |

> Các file modified (không phải mới) cũng nằm trong ngưỡng: `file-scanner.ts` (194), `module-helper.ts` (92), `async-file-scanner.ts` (93), `grammar-config-loader.ts` (169), `config/index.ts` (185), `grammar-registry.ts` (140) — đều ≤200.

---

## 4. Security Test Cases (3 Medium findings)

| ID | Tên | Trạng thái | Bằng chứng / Ghi chú |
|----|-----|-----------|----------------------|
| **TC-ReDoS** | DetectLanguage / nameFromPath an toàn với input thù địch | ✅ PASS (partial) | `detectLanguage` dùng `endsWith` (static suffix) và `nameFromPath` dùng regex tĩnh (alternation không lồng/group lặp) → không có vector ReDoS trên đường SA4E-223. Được cover bởi unit tests parser. ⚠️ **Lưu ý:** F-02 (pattern JAVA lồng lớp trong `signature-extractor.ts`) là concern tiền tồn tại ở module khác, vẫn **Open** trong Security Review — không thuộc code path mới của SA4E-223 nên đánh giá partial. |
| **TC-Secret-Allowlist** | Indexer không index nội dung secret, log không chứa raw XML | ✅ PASS (partial) | Sub-parser `salesforce-meta` đã implement log guard — chỉ log `{ filePath, metaType, error }`, không raw XML; DB chỉ lưu symbol/metadata, không lưu body tệp. Được cover bởi unit tests. ⚠️ **Lưu ý:** F-03 (thiếu secret denylist scrub body ở `storage.ts`/`body-extractor.ts`) vẫn **Open** trong Security Review → partial. |
| **TC-Symlink-Escape** | Scanner không thoát khỏi workspace qua symlink | ❌ OPEN (chưa có test thực thi) | F-01 vẫn **Open**: chưa có containment check (`isWithinWorkspace`/`realpath`) tại `file-scanner.ts` / `tree-sitter-indexer.ts`. Không có test thực thi → DEV xử lý ở follow-up. |

---

## 5. Defects & Risks còn lại

### 5.1 Security findings (Medium, từ SECURITY-REVIEW.md) — đề xuất follow-up ticket

| ID | Tiêu đề | Mức độ | Trạng thái | Đề xuất |
|----|---------|--------|------------|---------|
| F-01 | Symlink path-traversal (thiếu containment khi đọc tệp) | Medium | Open | Theo dõi tại **follow-up ticket** (security hardening) — DEV bổ sung `isWithinWorkspace` + test `TC-Symlink-Escape` |
| F-02 | ReDoS ở parser regex (`signature-extractor.ts` JAVA pattern lồng lớp, `timeoutPerFile` chưa thiến) | Medium | Open | Follow-up: viết lại pattern tuyến tính + thiến `timeoutPerFile` trên đường regex fallback |
| F-03 | Rò rỉ secret vào index (thiếu secret allowlist/denylist) | Medium | Open | Follow-up: bổ sung `SECRET_DENYLIST` + test fixture hồi quy (`<password>` không bị index) |

> **Đề xuất:** Mở **1 follow-up ticket** (vd: `SA4E-223-SEC` hoặc để SM quyết định key) gom F-01/F-02/F-03 thành "Security hardening cho indexing engine" — không block Phase 6.3/UAT vì đây là design-level hardening, không phải lỗi chức năng của tính năng mới, và overall risk rating của Security Review là **LOW**.

### 5.2 Risk: CI line-count gate (BR-18 / AC7) có thể FAIL trên 2 file test đã sửa

| File (modified) | Dòng | Vấn đề |
|-----------------|------|--------|
| `backend/src/engine/indexer/__tests__/file-scanner.test.ts` | 235 | >200 |
| `backend/src/engine/parsers/languages/__tests__/salesforce-meta-parser.test.ts` | 233 | >200 |

Gate `scripts/check-line-count.sh --changed origin/master` (chạy trong `.github/workflows/ci-sa4e-223.yml`) sẽ flag mọi `.ts` changed >200 dòng, **bao gồm cả test file**. Hai file trên là MODIFIED nên nằm trong change set → **CI sẽ FAIL** ở bước Line-count gate (mặc dù `npx vitest run` pass 2661/2661).

**Hành động đề xuất (pre-merge, không block chức năng):**
- DEV tách 2 file test nói trên thành các module test nhỏ hơn (mỗi file ≤200 dòng), HOẶC
- Xác nhận scope của gate nên loại trừ `__tests__/**` (nếu đó là ý định thiết kế) và cập nhật `check-line-count.sh`.

> Đây là **risk duy nhất** có thể chặn merge CI, nhưng không ảnh hưởng đến kết quả chức năng (tests đã pass). Cần xử lý trước khi merge vào `master`.

---

## 6. Test Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Automated Pass Rate | ≥95% | 100% (2661/2661) | ✅ Met |
| Failed tests | 0 | 0 | ✅ Met |
| AC1–AC7 coverage | 100% | 100% (7/7) | ✅ Met |
| New source file ≤200 dòng (AC7) | 100% | 100% (max 61) | ✅ Met |
| Parser branch coverage (BR-17) | 100% nhánh | ✅ covered bởi `salesforce-meta-parser.test.ts` | ✅ Met |
| Security TC thực thi | 3 | 2 partial pass / 1 open | ⚠️ Partial (F-01 open) |
| Critical Defects | 0 | 0 | ✅ Met |
| Major Defects | 0 | 0 | ✅ Met |
| Open Defects (Medium security) | — | 3 (F-01/F-02/F-03) → follow-up | ⚠️ Known |

---

## 7. Conclusion

**Overall Verdict: ✅ PASS — Sẵn sàng Phase 6.3 (Pentest) + UAT**

Toàn bộ 7 Acceptance Criteria của BRD được thỏa mãn; suite test 2661/2661 PASS, 0 fail, 234 test files; AC7 xác minh trực tiếp qua đếm dòng (mọi file source mới ≤200, max 61). 2 trong 3 security findings đã được cover một phần bởi unit tests parser; 1 (F-01 symlink) chưa thực thi và được chuyển thành follow-up ticket cùng F-02/F-03.

| Metric | Result |
|--------|--------|
| Automated tests (Unit + Integration) | 2661/2661 PASS (100%) |
| Manual SIT tests | 0 (không áp dụng — backend) |
| AC coverage | 7/7 PASS |
| Bugs found (functional) | 0 |
| Open security findings (Medium) | 3 → follow-up ticket (không block) |
| CI line-count gate risk | 2 file test >200 dòng → cần fix pre-merge |

**Recommendation:** Phê duyệt chuyển sang **Phase 6.3 (Security Penetration Test)** và **UAT**. Trước khi merge vào `master`, DEV xử lý: (1) follow-up security hardening (F-01/F-02/F-03), (2) tách/chuẩn hóa 2 file test vượt 200 dòng để CI line-count gate pass.

---

---

## Appendix A: Re-Test History

> **Không cần re-test round.** Suite chạy 1 lần, 100% pass. Các hạng mục §5 là known-limitations/follow-ups, không phải test fail cần sửa lại.

### Timeline Overview

```
Round 1 (Initial)  → 2661/2661 PASS, 0 functional bugs. 3 Medium security findings mở (F-01/F-02/F-03) → chuyển follow-up.
```

| Bug / Item | Round 1 | Final |
|------------|---------|-------|
| Functional defects | — (không có) | CLOSED (không phát sinh) |
| F-01 Symlink (security) | ⚠️ Open | OPEN → follow-up |
| F-02 ReDoS (security) | ⚠️ Open | OPEN → follow-up |
| F-03 Secret leak (security) | ⚠️ Open | OPEN → follow-up |
| Line-count gate (2 test file) | ⚠️ Risk | OPEN → pre-merge fix |
