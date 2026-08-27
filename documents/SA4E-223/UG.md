# User Guide — SA4E-223: Indexer nhận diện mở rộng các phần mở rộng tệp Salesforce

**Tài liệu:** User Guide (UG)
**Ticket:** SA4E-223
**Phiên bản UG:** 1.0
**Ngày:** 2026-08-27
**Backend áp dụng:** `backend` package `v1.38.0` (TDD SA4E-223 v1.0)
**Đối tượng:** Developer / người vận hành Code Intelligence Indexer

---

## 1. Tóm tắt tính năng mới

Trước SA4E-223, indexer chỉ nhận diện một tập nhỏ extension Salesforce (`.cls`, `.trigger`, `.pega`). Phần lớn tệp metadata (`*-meta.xml`), Aura và Visualforce **không được index** → mất contextual search trong các dự án SFDX lớn.

SA4E-223 mở rộng pipeline nhận diện & parse để bao phủ **toàn bộ** extension Salesforce:

- **Apex:** `.cls`, `.trigger`, `.apex` (anonymous), `.soql`
- **Aura:** `.cmp`, `.app`, `.evt`, `.intf`, `.tokens`
- **Visualforce:** `.page`, `.component`
- **Salesforce metadata (`*-meta.xml`):** flow, object, field, js, component, flexipage, permissionset, profile, labels, tab, layout, report, dashboard, site, resource, email, testSuite (17 compound suffix)
- **Pega:** `.pega` (giữ nguyên, không đổi)

Kết quả: các tệp này được quét qua Gate 2, parse lấy symbol cấp cao, và gán vào module tương ứng trong bảng `modules`/`files` của index.

---

## 2. Danh sách extension được hỗ trợ

Bảng ánh xạ **extension → language → module** và nơi nó xuất hiện trong `code_index_status`.

| Extension | Language (`detectLanguage`) | Module (`detectModule`) | Hiển thị trong `code_index_status` |
|-----------|----------------------------|-------------------------|------------------------------------|
| `.cls` | `apex` | `apex-classes` | SFDX stats: `Apex classes` + Languages + Modules |
| `.trigger` | `apex` | `apex-triggers` | SFDX stats: `Apex triggers` + Languages + Modules |
| `.apex` (anonymous) | `apex` | theo path (`force-app/classes` → `apex-classes`, else `salesforce`) | Languages (`apex`) + Modules |
| `.soql` | `apex` | theo path | Languages (`apex`) + Modules |
| `.cmp` | `aura` | `aura-components` | Languages (`aura`) + Modules |
| `.app` | `aura` | `aura-components` | Languages (`aura`) + Modules |
| `.evt` | `aura` | `aura-components` | Languages (`aura`) + Modules |
| `.intf` | `aura` | `aura-components` | Languages (`aura`) + Modules |
| `.tokens` | `aura` | `aura-components` | Languages (`aura`) + Modules |
| `.page` | `visualforce` | `visualforce-pages` | Languages (`visualforce`) + Modules |
| `.component` | `visualforce` | `visualforce-components` | Languages (`visualforce`) + Modules |
| `.flow-meta.xml` | `salesforce-meta` | `sf-flows` | SFDX stats: `Flows` + Languages + Modules |
| `.object-meta.xml` | `salesforce-meta` | `sf-objects` | SFDX stats: `Objects` + Languages + Modules |
| `.field-meta.xml` | `salesforce-meta` | `sf-objects` | Languages + Modules |
| `.js-meta.xml` | `salesforce-meta` | `lwc-components` | SFDX stats: `LWC components` + Languages + Modules |
| `.component-meta.xml` | `salesforce-meta` | `aura-components` | Languages + Modules |
| `.flexipage-meta.xml` | `salesforce-meta` | `sf-flexipages` | Languages + Modules |
| `.permissionset-meta.xml` | `salesforce-meta` | `sf-permissionsets` | Languages + Modules |
| `.profile-meta.xml` | `salesforce-meta` | `sf-profiles` | Languages + Modules |
| `.labels-meta.xml` | `salesforce-meta` | `sf-labels` | Languages + Modules |
| `.tab-meta.xml` | `salesforce-meta` | `sf-tabs` | Languages + Modules |
| `.layout-meta.xml` | `salesforce-meta` | `sf-layouts` | Languages + Modules |
| `.report-meta.xml` | `salesforce-meta` | `sf-reports` | Languages + Modules |
| `.dashboard-meta.xml` | `salesforce-meta` | `sf-dashboards` | Languages + Modules |
| `.site-meta.xml` | `salesforce-meta` | `sf-sites` | Languages + Modules |
| `.resource-meta.xml` | `salesforce-meta` | `sf-staticresources` | Languages + Modules |
| `.email-meta.xml` | `salesforce-meta` | `sf-email` | Languages + Modules |
| `.testSuite-meta.xml` | `salesforce-meta` | `sf-testsuites` | Languages + Modules |
| `.pega` | `pega` | theo path | Languages (`pega`) + Modules |

> **Lưu ý hiển thị:** Khối "Salesforce (SFDX)" trong `code_index_status` hiện chỉ in 5 dòng chuyên biệt (`Apex classes`, `Apex triggers`, `Flows`, `Objects`, `LWC components`) vì khối này tiền hiện (KSA-191). Các module metadata/VF/Aura mới của SA4E-223 được phản ánh qua mục **`Languages:`** (`salesforce-meta` / `visualforce` / `aura`) và **`Modules:`** (tổng số module) — không phải dòng SFDX chuyên biệt. Đây là hành vi dự kiến, không phải lỗi.

---

## 3. Cách thức hoạt động

Pipeline xử lý một tệp Salesforce như sau:

```
file scan (traverseDirectory)
   └─> processFile()
          ├─> detectLanguage(filePath)
          │      • Nếu path kết thúc bằng 1 trong SALESFORCE_META_SUFFIXES → 'salesforce-meta'
          │      • Else tra cứu EXTENSION_LANGUAGE_MAP[ext] (vd .cls→apex, .page→visualforce, .cmp→aura)
          ├─> Gate 2: includeExtensions
          │      • Simple ext ('.cls','.page','.cmp',...) phải nằm trong config.includeExtensions
          │      • Compound ext ('.xml' của *-meta.xml) được MIỄN TRỪ nếu language === 'salesforce-meta'
          ├─> parser theo language
          │      • apex        → tree-sitter Apex grammar (nếu WASM có) / fallback regex
          │      • visualforce → VisualforceParser (regex generic markup)
          │      • aura        → AuraParser (regex generic markup)
          │      • salesforce-meta → SalesforceMetaParser (per-type XML extractor)
          └─> symbols + detectModule(relativePath) → lưu vào files/symbols/modules
```

### 3.1 Visualforce & Aura — regex generic parse

`VisualforceParser` và `AuraParser` dùng helper `extractMarkupTopLevel` (regex/generic markup) để trích xuất **top-level symbol** (tên root tag: `apex:page`, `aura:component`, ...), prefix signature (`VisualforcePage`, `AuraComponent`, ...), modifier (`visualforce`, `aura`, ...) và một vài relationship nông (`controller`/`extensions` → `uses`/`apex-import`; `implements`/`extends` → `implements`/`inherits`).

**Không** có phân tích quan hệ symbol sâu (không trace scope/biến/containing class bên trong markup). Đây là thiết kế cố ý để coverage rộng, chi phí thấp.

### 3.2 Salesforce metadata — extract top-level + degrade gracefully

`SalesforceMetaParser` định loại meta qua `detectMetaType(filePath)` (dựa vào compound suffix), sau đó gọi parser chuyên biệt (`parseFlow`, `parseObject`, `parseField`, `parsePermissionset`, `parseProfile`, `parseLabels`, `parseTab`, `parseLayout`, `parseReport`, `parseDashboard`, `parseSite`, `parseResource`, `parseEmail`, `parseTestSuite`, `parseLWCMeta`, `parseAuraMeta`, `parseFlexipage`).

Mỗi branch được bọc `try/catch` riêng biệt:
- Nếu 1 file XML lỗi (malformed / thiếu node), parser ghi 1 `ParseError` (`salesforce-meta [<type>] parse failed: ...`) và **warn log**, nhưng vẫn trả về các symbol của các branch khác đã parse thành công.
- Toàn bộ symbol cuối cùng được lọc qua `isSecretElement(name)` (F-03) — tên phần tử bí mật (password/secret/... trong `*.labels-meta.xml`, `*.profile-meta.xml`, ...) **không bao giờ** được index.

---

## 4. Cách verify

### 4.1 Unit / Integration tests

Từ thư mục `backend`:

```powershell
cd backend
npx vitest run
```

Toàn bộ suite (bao gồm file-scanner.test.ts cho extension mapping) sẽ chạy. Các test case liên quan SA4E-223:
- `file-scanner.test.ts` — `detectLanguage` map đúng `.cls/.trigger/.apex/.soql/.page/.component/.cmp/.app/.evt/.intf/.tokens` và **17** `*-meta.xml` suffix → `salesforce-meta`.
- `file-scanner.test.ts` — Gate 2 đồng bộ: extension mới đi qua khi nằm trong `includeExtensions` (TC-04a), bị skip khi không (TC-04b).
- `module-helper.test.ts` — `detectModule` map segment (`/pages/`, `/components/`, `/layouts/`, `/aura/`, `/testSuites/`, ...) → module đúng.
- `salesforce-meta-parser.test.ts` — parse từng loại metadata, degrade gracefully với XML lỗi.
- `salesforce-extensions.test.ts` — `DEFAULT_EXTENSIONS` chứa các extension Salesforce mới.

### 4.2 Chạy indexer trên 1 SFDX project mẫu

1. Tạo/lấy 1 project SFDX (có `sfdx-project.json` hoặc thư mục `force-app`) chứa các tệp metadata/Aura/VF mẫu.
2. Point workspace vào project và khởi chạy indexer (MCP server backend):
   ```powershell
   $env:CODE_INTEL_WORKSPACE = "C:/path/to/your-sfdx-project"
   cd backend
   npx tsx src/index.ts
   ```
3. Gọi tool `code_index_status` (qua MCP client hoặc test E2E) — có thể truyền `{ "reindex": true }` để force full index.
4. Trong output, xác nhận:
   - Mục `Languages:` có `salesforce-meta`, `visualforce`, `aura` với số file > 0.
   - Mục `Modules:` có các module như `sf-layouts`, `sf-permissionsets`, `aura-components`, `visualforce-pages`, `sf-testsuites`, ...
   - Nếu project có class/trigger/flow/object/lwc, khối `Salesforce (SFDX):` in đúng các con số tương ứng.

---

## 5. Known limitations / Out of scope

- **Không có deep semantic parsing** cho Visualforce/Aura: chỉ lấy top-level symbol + relationship nông (controller/extends/implements). Không trace biến, method, scope bên trong markup.
- **Không có tree-sitter grammar** cho Visualforce / Aura: hiện dùng regex generic (`extractMarkupTopLevel`). Theo dõi (follow-up) để bổ sung grammar sâu hơn nếu cần.
- **Metadata parser là best-effort:** một số node lồng sâu/thuộc tính tùy chỉnh có thể không được trích xuất; file lỗi sẽ bị skip phần đó nhưng không làm sập index.
- **Khối SFDX stats chuyên biệt** (KSA-191) chưa liệt kê tên từng module metadata mới — chúng chỉ nằm trong `Languages`/`Modules` tổng. (Có thể mở rộng ở follow-up.)
- Pega (`.pega`) không đổi hành vi trong SA4E-223.

---

## 6. Troubleshooting — "tệp của tôi không được index"

Kiểm tra theo thứ tự (từ ngoài vào trong):

1. **Extension có trong `EXTENSION_LANGUAGE_MAP`?** (`backend/src/engine/indexer/file-scanner.ts`)
   - Nếu extension đơn (`.page`, `.cmp`, `.apex`, ...) chưa có → `detectLanguage` trả `null` → bỏ qua. Thêm vào map.
2. **Extension có nằm trong `includeExtensions` (Gate 2)?**
   - `DEFAULT_EXTENSIONS` ở `backend/src/config/index.ts` đã chứa các extension mới. Nếu bạn override `includeExtensions` qua file config/env, phải thêm thủ công các extension đó.
   - Đặc biệt: compound `*-meta.xml` có `ext === '.xml'` (không nằm trong `includeExtensions`) nhưng được miễn trừ nếu `language === 'salesforce-meta'`.
3. **Compound suffix có trong `SALESFORCE_META_SUFFIXES`?** (`file-scanner.ts`)
   - Nếu suffix metadata mới chưa liệt kê → `detectLanguage` không trả `salesforce-meta` → Gate 2 loại (`ext === '.xml'` không khớp). Thêm suffix vào mảng này.
4. **Có trong `grammar-config.json`?** (`backend/src/engine/parsers/grammar-config.json`)
   - Mỗi language (`apex`, `salesforce-meta`, `visualforce`, `aura`) phải có entry `extensions` tương ứng để pipeline chọn đúng parser module. Thiếu → parser không được đăng ký.
5. **Module segment có trong `detectModule`?** (`backend/src/engine/indexer/module-helper.ts`)
   - Nếu tệp nằm ở thư mục chưa được xét segment (vd `/myCustomFolder/X.layout-meta.xml`), nó vẫn vào module `salesforce` chung thay vì `sf-layouts`. Thêm điều kiện segment nếu cần module cụ thể.
6. **File có bị exclude?** — `.gitignore`, `excludePatterns`, hoặc bắt đầu bằng `.` sẽ bị bỏ qua. File > `maxFileSize` (mặc định 512KB) cũng bị skip.
7. **Workspace có phải SFDX?** — `code_index_status` chỉ in khối `Salesforce (SFDX):` khi phát hiện `sfdx-project.json` hoặc thư mục `force-app`. Metadata vẫn được index bình thường vào `Languages`/`Modules` kể cả khi không phải SFDX, nhưng khối SFDX chuyên biệt sẽ không hiện.

---

*UG được sinh tự động bởi dev-agent dựa trên TDD SA4E-223 v1.0 và source code thực tế (file-scanner.ts, module-helper.ts, grammar-config.json, salesforce-meta/visualforce/aura parser, code-index-status.ts, sfdx-helper.ts).*
