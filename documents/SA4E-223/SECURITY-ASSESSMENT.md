# 🔒 Security Assessment Report — SA4E-223 (Security Code Review)

> **Loại đánh giá:** Security Code Review (static review của mã nguồn vừa implement trên working tree `dnguyenminh/SA4E-223`)
> **Phạm vi (5 touchpoints):** `backend/src/engine/indexer/file-scanner.ts`, `backend/src/config/index.ts`, `backend/src/engine/indexer/project-type/resolver.ts`, `backend/src/engine/parsers/grammar-config.json` (+ `parsers/languages/visualforce`, `aura`, `salesforce-markup`, `salesforce-meta`), `backend/src/engine/indexer/module-helper.ts`
> **Ngày:** 2026-08-27
> **Người đánh giá:** security-agent
> **Phiên bản:** 1.0
> **Phương pháp:** Đọc và phân tích tĩnh (manual review) + đối chiếu với `documents/SA4E-223/SECURITY-REVIEW.md` (Phase 3.7)

---

## 1. Tóm tắt (Executive Summary)

Đợt review này xác minh 3 Medium findings (F-01/F-02/F-03) đã được ghi nhận tại Phase 3.7 trên **mã nguồn thực tế vừa implement** cho SA4E-223 (thêm Salesforce simple extensions + 17 compound `*-meta.xml` parsers). Kết quả tổng quan: **không có lỗ hổng Critical hay High**. Rủi ro tổng thể ở mức **LOW**.

- **F-01 (Symlink path-traversal): CHƯA được xử lý** — `file-scanner`/`async-file-scanner` vẫn đọc tệp theo symlink mà không có kiểm tra containment (`realpath` + `startsWith(workspace)`). → Cần DEV xử lý riêng (đã được note).
- **F-02 (ReDoS): XỬ LÝ MỘT PHẦN** — các regex trong parser mới đều **tuyến tính (linear)**, không có catastrophic backtracking ✅. Tuy nhiên `timeoutPerFile` vẫn **chưa được thiến** lên đường `parse()` / `regexFallback` (defense-in-depth còn thiếu).
- **F-03 (Secret denylist): XỬ LÝ MỬC MỘT PHẦN** — đã có `SECRET_ELEMENT_NAMES` + `isSecretElement` và áp dụng lọc `symbol.name` trong `SalesforceMetaParser.parse()` ✅. Tuy nhiên denylist chỉ lọc *tên*, chưa lọc *giá trị* secret tại tầng lưu body/source (`extractAndStoreBodies`).

**Xác nhận bổ sung:**
- ✅ **XXE không áp dụng** — toàn bộ parser mới dùng regex, không dùng XML DOM parser.
- ✅ **Không thêm dependency XML mới** — `grep` trong `package.json` trả về 0 kết quả cho `xml/fast-xml/xmldom/sax/libxml`.
- ✅ `maxFileSize` 512KB vẫn được thiến → giới hạn DoS tệp lớn.

**Overall Risk Rating:** 🟢 **LOW**

| Mức độ | Số lượng |
|--------|----------|
| 🔴 Critical | 0 |
| 🟠 High | 0 |
| 🟡 Medium | 3 (F-01 Open, F-02 Partial, F-03 Partial) |
| 🔵 Low | 0 |
| ℹ️ Informational | 2 |

---

## 2. Xác nhận 3 Medium findings (kết quả verify)

| ID | Tiêu đề | Trạng thái SA4E-223 | Bằng chứng (file:line) |
|----|---------|----------------------|------------------------|
| **F-01** | Symlink path-traversal (thiếu containment) | ❌ **CHƯA XỬ LÝ** (Open) | `file-scanner.ts:146-172` (`processFile`), `:83-101` (`scanSingleFile`); `async-file-scanner.ts:69-104` |
| **F-02** | ReDoS ở parser regex mới | ✅ regex linear / ⚠️ thiếu per-file timeout | `salesforce-markup/shared.ts:16-17`, `salesforce-meta/helpers.ts:18,28` (linear); `tree-sitter-indexer.ts:39,42,58-63` (chưa bọc timeout) |
| **F-03** | Rò rỉ secret vào index | ✅ denylist đã có / ⚠️ chỉ lọc tên, chưa lọc body | `salesforce-meta/helpers.ts:8-15`, `salesforce-meta/parser.ts:64-65` |

---

## 3. Detailed Findings

### Finding F-01: Symlink path-traversal — CHƯA XỬ LÝ (Medium)

| Thuộc tính | Giá trị |
|-----------|--------|
| **Mức độ** | 🟡 Medium |
| **OWASP** | A01:2021 — Broken Access Control |
| **CWE** | CWE-59: Improper Link Resolution Before File Access ('Link Following') |
| **Vị trí** | `backend/src/engine/indexer/file-scanner.ts:146-172`, `:83-101`; `backend/src/engine/indexer/async-file-scanner.ts:69-104` |
| **Trạng thái** | Open (chưa xử lý trong SA4E-223) |

**Mô tả:**
Quá trình quét duyệt qua `entry.isDirectory()` / `entry.isFile()` (khi gặp symlink, `Dirent` tự động `stat` target → đi theo symlink). Tại tầng đọc thực tế, `fs.readFileSync` / `fs.statSync` / `fsp.stat` / `fsp.readFile` được gọi trên `fullPath` **mà không canonicalize (realpath) cũng không kiểm tra xem realpath có nằm trong `config.workspace` hay không**. Nếu attacker tạo được một symlink bên trong workspace trỏ ra tệp nhạy cảm ngoài workspace (`.env`, `~/.ssh/id_rsa`, `backend/src/admin/db/password.ts`), nội dung sẽ bị đọc, index và có thể lộ qua truy vấn search.

**Bằng chứng:**
```typescript
// backend/src/engine/indexer/file-scanner.ts:154-158 (processFile)
try {
  const stat = fs.statSync(fullPath);          // ← đi theo symlink
  if (stat.size > config.maxFileSize) return null;
  const content = fs.readFileSync(fullPath, 'utf-8');  // ← đi theo symlink, KHÔNG containment
  ...
// backend/src/engine/indexer/async-file-scanner.ts:82-85 (processFile)
  const stat = await fsp.stat(fullPath);        // ← tương tự
  if (stat.size > config.maxFileSize) return null;
  const content = await fsp.readFile(fullPath, 'utf-8');
```

**Tác động:** Information disclosure — đọc được secret/credential/tệp hệ thống nằm ngoài workspace thông qua cơ chế index & search.

**Remediation (đề xuất cho DEV — áp dụng chung):**
```typescript
// backend/src/engine/indexer/path-safety.ts (mới)
import { realpathSync } from 'node:fs';
import * as path from 'node:path';

export function isWithinWorkspace(filePath: string, workspace: string): boolean {
  const resolved = realpathSync(filePath);                  // đi theo symlink → path thực
  const root = path.resolve(workspace);
  return resolved === root || resolved.startsWith(root + path.sep);
}
```
Áp dụng tại đầu `processFile` (cả `file-scanner.ts` và `async-file-scanner.ts`) và `scanSingleFile`:
```typescript
if (!isWithinWorkspace(fullPath, config.workspace)) return null; // bỏ qua symlink escape
```
> Pattern này đã được dùng đúng ở `backend/src/servers/atlassian/tools/jira-attachment-tools.ts` (`realpath` + `startsWith`) — tái sử dụng.

---

### Finding F-02: ReDoS ở parser regex mới — XỬ LÝ MỘT PHẦN (Medium)

| Thuộc tính | Giá trị |
|-----------|--------|
| **Mức độ** | 🟡 Medium |
| **OWASP** | A04:2021 — Insecure Design (DoS) |
| **CWE** | CWE-1333: Inefficient Regular Expression Complexity (ReDoS) |
| **Vị trí** | `backend/src/engine/parsers/languages/salesforce-markup/shared.ts:16-17`, `backend/src/engine/parsers/languages/salesforce-meta/helpers.ts:18,28` (regex linear); `backend/src/engine/parsers/tree-sitter-indexer.ts:39,42,58-63` (chưa bọc `timeoutPerFile`) |
| **Trạng thái** | Partial — regex linear ✅ / thiếu per-file timeout ⚠️ |

**Mô tả & Verification:**
1. **Regex có linear không? → CÓ (ReDoS-safe).** Tất cả regex trong parser mới đều không có lượng tử lồng nhau chồng lấp:
   - `ROOT_TAG_RE = /<([a-zA-Z][\w:-]*)\b[^>]*>/` — `[^>]*` bị chặn bởi `>`, tuyến tính.
   - `ATTR_RE = /${attr}\s*=\s*["']([^"']*)["']/i` — `\s*` và `[^"']*` không chồng lấp → tuyến tính.
   - `extractXmlValues`: `/<${tagName}>([^<]*)<\/${tagName}>/g` — tuyến tính.
   - `extractXmlBlocks`: `/<${tagName}>[\s\S]*?<\/${tagName}>/g` — lazy, tuyến tính (không catastrophic backtracking).
   - `nameFromPath` / `inferObjectFromFieldPath`: chỉ `replace`/`match` đơn giản, tuyến tính.
   → **Kết luận: parser mới KHÔNG có nguy cơ ReDoS do nested quantifier.** Đây là điểm tích cực của thiết kế (header `shared.ts` ghi rõ "linear regex only, ReDoS-safe").
2. **Có per-file timeout không? → CHƯA.** `timeoutPerFile` đã được định nghĩa (`grammar-config-loader.ts:61`, mặc định 5000ms) nhưng **chưa được tham chiếu** khi gọi `parser.parse(source, relativePath)` (`tree-sitter-indexer.ts:39`) cũng như trong `regexFallback` (`:58-63`). Đường parse đồng bộ của các parser mới không có "phanh" thời gian.

**Tác động:** Với regex linear, rủi ro treo do ReDoS là thấp. Tuy nhiên, thiếu timeout là khoảng trống defense-in-depth: một tệp có kích thước lớn gần 512KB với cấu trúc lặp có thể làm parse chậm (dù không exponential). Áp dụng timeout là biện pháp an toàn chung cho cả parser cũ (JAVA pattern ở `signature-extractor.ts`) và mới.

**Remediation (đề xuất cho DEV):**
```typescript
// helper (có thể đặt trong grammar-registry hoặc tree-sitter-indexer)
async function withTimeout<T>(p: Promise<T> | T, ms: number): Promise<T> {
  let t: NodeJS.Timeout;
  const to = new Promise<never>((_, rej) => { t = setTimeout(() => rej(new Error('parse-timeout')), ms); });
  try { return await Promise.race([Promise.resolve(p), to]); }
  finally { clearTimeout(t); }
}
// trong tree-sitter-indexer.indexFile(), bọc parse:
const result = await withTimeout(parser.parse(source, relativePath), this.registry.timeoutPerFile ?? 5000);
```
> Lưu ý: `parse()` của các parser mới là **đồng bộ**, nên cần bọc qua `Promise.resolve()` hoặc chuyển thành async wrapper; với tệp lớn nên cân nhắc giới hạn kích thước buffer truyền vào (đã có `maxFileSize` 512KB hỗ trợ).

---

### Finding F-03: Rò rỉ secret vào index — XỬ LÝ MỬC MỘT PHẦN (Medium)

| Thuộc tính | Giá trị |
|-----------|--------|
| **Mức độ** | 🟡 Medium |
| **OWASP** | A02:2021 — Cryptographic Failures (Sensitive Data Exposure) |
| **CWE** | CWE-200: Exposure of Sensitive Information to an Unauthorized Actor |
| **Vị trí** | `backend/src/engine/parsers/languages/salesforce-meta/helpers.ts:8-15`, `backend/src/engine/parsers/languages/salesforce-meta/parser.ts:64-65` |
| **Trạng thái** | Partial — denylist đã có ✅ / chỉ lọc tên, chưa lọc body ⚠️ |

**Mô tả & Verification:**
1. **Extract symbol có lọc element `<password>`/`<loginUrl>`/secret không? → CÓ.** `salesforce-meta/helpers.ts` định nghĩa:
   ```typescript
   export const SECRET_ELEMENT_NAMES = new Set([
     'password', 'loginurl', 'secret', 'clientsecret', 'accesstoken', 'clientsecretortoken',
   ]);
   export function isSecretElement(name: string | undefined | null): boolean {
     if (!name) return false;
     return SECRET_ELEMENT_NAMES.has(name.trim().toLowerCase());
   }
   ```
   và `SalesforceMetaParser.parse()` (`:64-65`) lọc:
   ```typescript
   symbols = symbols.filter(s => !isSecretElement(s.name));
   ```
2. **Index có leak secret từ metadata không? → KHÔNG qua symbol, nhưng CÓ nguy cơ qua body.**
   - Các sub-parser (`profile/permissionset/site/flow/object/field/lwc/labels/...`) **chỉ đọc các element được whitelist** (`type`, `referenceTo`, `fullName`, `name`, `dataType`, `processType`, `isExposed`, `datasource`) và đặt `symbol.name` = tên tệp hoặc `<fullName>`/`<name>`. Chúng **không** trích xuất nội dung của `<password>`/`<loginUrl>`/`<secret>` → giá trị secret không bị biến thành symbol. ✅
   - **Điểm hở:** denylist chỉ lọc theo `symbol.name`. Nếu một file metadata chứa `<password>secret123</password>`, nội dung `secret123` **không** xuất hiện trong symbol, nhưng **có thể** nằm trong phần body/source được lưu bởi tầng `extractAndStoreBodies` / `body-extractor.ts` (F-03 gốc tại Phase 3.7) — tầng này **không nằm trong 5 touchpoints** và chưa được lọc. Do đó secret value vẫn có thể lộ qua truy vấn embedding/body.

**Tác động:** Giảm đáng kể rủi ro lộ tên element bí mật; nhưng giá trị secret thực tế trong source vẫn có thể rò rỉ qua tầng lưu body nếu chưa được scrub.

**Remediation (đề xuất cho DEV):**
```typescript
// Mở rộng denylist xuống tầng body-storage (extractAndStoreBodies / body-extractor.ts):
const SECRET_VALUE_RE = /(password|passwd|pwd|token|secret|api[_-]?key|clientsecret|accesstoken)\s*[:=]\s*["']?[^\s"']{1,256}/gi;
export function scrubSecretBody(body: string): string {
  return body.replace(SECRET_VALUE_RE, '$1=***REDACTED***');
}
// Áp dụng trước khi lưu embedding/body cho MỌI ngôn ngữ (không chỉ salesforce-meta).
```
> Đồng thời bổ sung regression test: index tệp chứa `<password>secret123</password>` → search trả về rỗng ở cả kết quả symbol VÀ body.

---

## 4. Informational Findings (bổ sung)

### I-01 (Informational): Duplicate suffix lists — nguy cơ drift
`SALESFORCE_META_SUFFIXES` (`file-scanner.ts:67-72`) và `META_SUFFIXES` (`salesforce-meta/detectMetaType.ts:7-11`) định nghĩa 2 danh sách suffix gần giống nhau ở 2 nơi. Nếu một trong hai bị cập nhật thiếu (drift), một `*-meta.xml` có thể bị route sai parser (ví dụ rớt vào `extractMarkupTopLevel` thay vì `salesforce-meta`), làm thay đổi hành vi extraction. Không phải lỗ hổng bảo mật trực tiếp, nhưng ảnh hưởng tính nhất quán của kiểm soát (bao gồm F-03). → Đề xuất gom chung một nguồn duy nhất (`detectMetaType.ts` là single source of truth, `file-scanner.ts` import từ đó).

### I-02 (Informational): `isSecretElement` import nhưng không dùng ở `labels.ts`
`backend/src/engine/parsers/languages/salesforce-meta/parsers/labels.ts:2` import `isSecretElement` nhưng không sử dụng (vì lọc đã tập trung ở `parser.ts:65`). Vô hại, nhưng cho thấy denylist chỉ áp dụng ở một điểm — đúng hướng, tuy nhiên cần đảm bảo mọi nhánh `parse()` đều đi qua `parser.ts` (không có sub-parser nào push symbol trực tiếp ra ngoài filter).

---

## 5. Điểm tích cực (Positive Observations)

- ✅ **XXE không áp dụng** — parser mới dùng regex, không XML DOM parser.
- ✅ **Không thêm dependency XML mới** — `package.json` không có `xml/fast-xml/xmldom/sax/libxml`.
- ✅ **Regex trong parser mới đều linear** (F-02) — không catastrophic backtracking.
- ✅ **Có secret denylist** ở salesforce-meta parser (F-03) — bước đầu tốt.
- ✅ **`maxFileSize` 512KB** vẫn giới hạn kích thước tệp đọc/index.
- ✅ `grammar-config.json` load từ `configDir` (đường tin cậy), không từ input người dùng.
- ✅ `module-helper.ts` / `resolver.ts` / `config/index.ts` không chứa regex/injection/command-exec — chỉ là ánh xạ phần mở rộng & module classification (an toàn).

---

## 6. Kết luận & Phân công (Conclusion & Hand-off)

**Kết luận:** Mức rủi ro tổng thể **LOW**. Không có Critical/High. Trong 3 Medium findings từ Phase 3.7:
- **F-01 vẫn OPEN** → DEV phải xử lý riêng (containment check).
- **F-02** được giảm thiểu ở mức regex (linear) nhưng **cần thiến `timeoutPerFile`** làm defense-in-depth.
- **F-03** có denylist nhưng **cần mở rộng xuống tầng body-storage** để đóng hoàn toàn.

**Phân công:**
- 🛠️ **DEV:** (1) F-01 — thêm `isWithinWorkspace` (realpath + containment) tại `processFile`/`scanSingleFile`/`async-file-scanner`; (2) F-02 — bọc `parser.parse()` bằng `withTimeout(timeoutPerFile)`; (3) F-03 — mở rộng denylist/scrub xuống `extractAndStoreBodies`.
- 🧪 **QA:** bổ sung TC-Symlink-Escape, TC-ReDoS (timeout), TC-Secret-Allowlist (symbol + body).
- 🟰 **SA:** không cần sửa TDD.

---

## 7. Phụ lục (Appendix)

### A. Scope Limitations
- Đây là **static code review**, không dynamic testing / penetration testing / runtime test.
- Không đánh giá hạ tầng, mạng, deploy.
- Các tầng ngoài 5 touchpoints (vd `tree-sitter-indexer.ts`, `body-extractor.ts`, `extractAndStoreBodies`) chỉ được tham chiếu để xác nhận trạng thái F-02/F-03, không review toàn diện.

### B. Evidence Index
| Finding | File:Line |
|---------|-----------|
| F-01 | `file-scanner.ts:154-158, 83-101`; `async-file-scanner.ts:82-85` |
| F-02 (linear) | `salesforce-markup/shared.ts:16-17`; `salesforce-meta/helpers.ts:18,28` |
| F-02 (timeout thiếu) | `tree-sitter-indexer.ts:39,42,58-63`; `grammar-config-loader.ts:61` |
| F-03 (denylist) | `salesforce-meta/helpers.ts:8-15`; `salesforce-meta/parser.ts:64-65` |
| I-01 | `file-scanner.ts:67-72` vs `salesforce-meta/detectMetaType.ts:7-11` |
| I-02 | `salesforce-meta/parsers/labels.ts:2` |

### C. Methodology
- Đọc tĩnh 5 touchpoints + liên quan (`async-file-scanner.ts`, `tree-sitter-indexer.ts`, `grammar-config-loader.ts`).
- Đối chiếu OWASP Top 10 (2021) + CWE.
- Xác nhận XXE / dependency XML qua grep `package.json`.
