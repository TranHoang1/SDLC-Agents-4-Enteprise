# 🔒 Báo cáo Security Design Review — SA4E-223

> **Loại đánh giá:** Security Design Review (static / design-level review của module indexing & grammar parser)
> **Phạm vi:** `backend/src/engine/` — file scanner, tree-sitter indexer, regex signature extractor, grammar-config loader, storage/body extractor.
> **Ngày:** 2026-08-27
> **Người đánh giá:** security-agent
> **Phiên bản:** 1.0 (tái lập từ kết quả đợt review trước — file chưa được ghi xuống disk)

---

## 1. Tóm tắt (Executive Summary)

Đợt Security Design Review tập trung vào luồng đọc tệp và indexing của engine (file scanner → tree-sitter / regex fallback → storage & embedding). Tổng quan: **không phát hiện lỗ hổng Critical hay High**. Rủi ro ở mức **LOW**.

Có **3 Medium findings** cần xử lý ở mức độ thiết kế/triển khai:
- **F-01 — Symlink containment:** đường đọc tệp (`fs.readFileSync` / `fs.statSync`) tự động đi theo symlink nhưng **chưa có kiểm tra chứa (containment)** trong `config.workspace` → nguy cơ đọc/Index nội dung tệp ngoài workspace (path traversal qua symlink).
- **F-02 — ReDoS ở parser regex mới:** một số pattern regex trong `signature-extractor.ts` (đặc biệt pattern JAVA) có **quantifier lồng nhau chồng lấp** → có thể catastrophic backtracking trên input thù địch; đồng thời `timeoutPerFile` chưa được thiến trên đường regex fallback.
- **F-03 — Rò rỉ secret vào index:** engine index toàn bộ body/symbol mà **không có secret allowlist/denylist** → nội dung secret (ví dụ fixture `<password>`) có thể bị index và lộ qua truy vấn sau này.

Ngoài ra có **2 Low** và **3 Informational** (chi tiết ở mục 4).

**Overall Risk Rating:** 🟢 **LOW**

| Mức độ | Số lượng |
|--------|----------|
| 🔴 Critical | 0 |
| 🟠 High | 0 |
| 🟡 Medium | 3 |
| 🔵 Low | 2 |
| ℹ️ Informational | 3 |

---

## 2. Điểm tích cực (Positive Observations)

Những điểm thiết kế đã làm **tốt** và không cần thay đổi:

- **XXE không áp dụng:** engine parse source bằng **regex / tree-sitter**, không dùng XML DOM parser → không có nguy cơ XML External Entity (XXE). ✅
- **Không thêm dependency XML:** thiết kế giữ nguyên stack hiện có, không引入 thư viện parse XML mới → không mở rộng attack surface. ✅
- **Log hygiene đúng:** không có secret/credential nào bị ghi vào log (không thấy `password`/`token` trong `logger.*` tại các module được review). ✅
- **Grammar config load từ đường dẫn tin cậy:** `grammar-config-loader.ts` load grammar `.grammar.json` và `grammarWasm` từ `configDir` (đường dẫn cấu hình xác định, không từ input người dùng) → tránh path injection vào config. ✅
- **`maxFileSize` 512KB được thiến:** `backend/src/config/index.ts:36` (`maxFileSize` default `512_000`) và `file-scanner.ts:137` (`if (stat.size > config.maxFileSize) return null;`) → giới hạn kích thước tệp đọc/index, giảm rủi ro DoS do tệp quá lớn. ✅
- **SQL an toàn ở module liên quan:** `traverse-helpers.ts:14` dùng allowlist cho `edgeTypes` kèm parameterized query (SEC-01) → không có SQL injection ở truy vấn đồ thị. ✅

---

## 3. Detailed Findings — Medium

### F-01: Symlink path-traversal (thiếu containment khi đọc tệp)

| Thuộc tính | Giá trị |
|-----------|--------|
| **Mức độ** | 🟡 Medium |
| **OWASP** | A01:2021 — Broken Access Control |
| **CWE** | CWE-59: Improper Link Resolution Before File Access ('Link Following') |
| **Vị trí** | `backend/src/engine/indexer/file-scanner.ts:136-139` (processFile), `backend/src/engine/parsers/tree-sitter-indexer.ts:29-31, 58-60` (indexFile / regexFallback), `file-scanner.ts:60-78` (scanSingleFile) |
| **Trạng thái** | Open |

**Mô tả:**
Quá trình quét (`traverseDirectory`) dùng `entry.isFile()` / `entry.isDirectory()` nên về cơ bản **bỏ qua symlink** khi duyệt — đây là hành vi phòng thủ tốt. Tuy nhiên, đường đọc thực tế ở tầng dưới (`fs.readFileSync(filePath, 'utf-8')` và `fs.statSync(filePath)`) **tự động đi theo symlink** mà **không kiểm tra xem tệp thực sự (realpath) có nằm trong `config.workspace` hay không**. Nếu attacker đặt được một symlink bên trong workspace trỏ tới tệp nhạy cảm ngoài workspace (ví dụ `~/.ssh/id_rsa`, `.env`, `backend/src/admin/db/password.ts`), nội dung tệp đó sẽ bị đọc, index và có thể lộ qua truy vấn tìm kiếm sau này.

**Bằng chứng:**
```typescript
// backend/src/engine/parsers/tree-sitter-indexer.ts:29-31
const stat = fs.statSync(filePath);
if (stat.size > this.maxFileSize) return await this.regexFallback(filePath, relativePath, projectId, startTime);
source = fs.readFileSync(filePath, 'utf-8');   // ← đi theo symlink, không kiểm tra containment
```

**Tác động:**
Rò rỉ thông tin (information disclosure) — attacker đọc được secret/credential/tệp hệ thống nằm ngoài workspace thông qua cơ chế index & search.

**Khuyến nghị (Remediation):**
Thêm bước **canonicalize + containment check** trước mọi thao tác đọc. Pattern này đã được dùng đúng ở `backend/src/servers/atlassian/tools/jira-attachment-tools.ts:65-68` (`realpath` + kiểm tra `startsWith`) — hãy tái sử dụng:

```typescript
// helper mới (ví dụ: backend/src/engine/indexer/path-safety.ts)
import { realpathSync } from 'node:fs';
import * as path from 'node:path';

export function isWithinWorkspace(filePath: string, workspace: string): boolean {
  const resolved = realpathSync(filePath);            // đi theo symlink → path thực
  const root = path.resolve(workspace);
  return resolved === root || resolved.startsWith(root + path.sep);
}
```

Áp dụng tại đầu `indexFile` / `regexFallback` (tree-sitter-indexer.ts) và `scanSingleFile` (file-scanner.ts):

```typescript
// trong indexFile(), trước fs.statSync:
if (!isWithinWorkspace(filePath, this.workspace)) {
  return { filePath: relativePath, symbolCount: 0, relationshipCount: 0,
           parseErrors: 1, duration: Date.now() - startTime, method: 'skipped', dependencies: [] };
}
```

**Tham khảo:**
- CWE-59: https://cwe.mitre.org/data/definitions/59.html
- OWASP Path Traversal: https://owasp.org/www-community/attacks/Path_Traversal

---

### F-02: ReDoS ở parser regex mới (cần regex tuyến tính + per-file timeout)

| Thuộc tính | Giá trị |
|-----------|--------|
| **Mức độ** | 🟡 Medium |
| **OWASP** | A04:2021 — Insecure Design (DoS) |
| **CWE** | CWE-1333: Inefficient Regular Expression Complexity (ReDoS) |
| **Vị trí** | `backend/src/engine/parsers/signature-extractor.ts:150` (JAVA_PATTERNS), `:47` (`matchAll` không giới hạn); `backend/src/engine/parsers/grammars/grammar-config-loader.ts:61` (`timeoutPerFile` chưa thiến trên đường regex) |
| **Trạng thái** | Open |

**Mô tả:**
`extractSymbols` dùng `content.matchAll(new RegExp(pattern.regex, 'gm'))` chạy trên **toàn bộ nội dung tệp** cho mỗi pattern. Một số pattern có **quantifier lồng nhau chồng lấp** trên tập ký tự whitespace, dễ dẫn đến **catastrophic backtracking** nếu source chứa chuỗi "gần khớp" (ví dụ nhiều khoảng trắng trước dấu `(`). Cụ thể, pattern JAVA tại dòng 150:

```typescript
{ regex: /^\s*(?:(?:public|private|protected)\s+)?(?:static\s+)?(?:[\w<>]+(?:\s*\[\])*\s+)(\w+)\s*\(/m, kind: 'function', nameGroup: 1 }
```

Phần `(?:[\w<>]+(?:\s*\[\])*\s+)` kết hợp `[...]+`, `(?:\s*\[\])*` và `\s+` — các lượng tử chồng lấp trên whitespace → đầu vào thù địch (nhiều space trước `(`) có thể kích hoạt backtracking hàm mũ. Thêm nữa, `timeoutPerFile` (đã định nghĩa `grammar-config-loader.ts:61`, mặc định 5000ms) **chưa được thiến** trên đường `regexFallback` (`tree-sitter-indexer.ts:58-70`) → không có "phanh" thời gian cho đường regex.

**Tác động:**
Một tệp nguồn được chế (hoặc vô tình) có thể làm thread parse treo hàng giây → từ chối dịch vụ cục bộ (DoS) trong quá trình indexing.

**Khuyến nghị (Remediation):**
1. **Viết lại pattern thành tuyến tính** (loại bỏ chồng lấp lượng tử). Ví dụ sửa JAVA pattern:
```typescript
// tuyến tính: chỉ 1 cặp [] tuỳ chọn, không lồng \s* trong nhóm lặp
{ regex: /^\s*(?:(?:public|private|protected)\s+)?(?:static\s+)?[\w<>]+(?:\s*\[\])?\s+(\w+)\s*\(/m, kind: 'function', nameGroup: 1 }
```
2. **Thiến `timeoutPerFile`** trên đường regex fallback (bọc parse trong race với timeout):
```typescript
// trong regexFallback (tree-sitter-indexer.ts):
async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: NodeJS.Timeout;
  const to = new Promise<never>((_, rej) => { t = setTimeout(() => rej(new Error('parse-timeout')), ms); });
  try { return await Promise.race([p, to]); }
  finally { clearTimeout(t); }
}
// gọi: const symbols = await withTimeout(Promise.resolve(extractSymbols(source, language)), this.registry.timeoutPerFile ?? 5000);
```
3. Giới hạn kích thước `content` truyền vào `extractSymbols` (đã có `maxFileSize` 512KB hỗ trợ) và cân nhắc quét theo dòng thay vì `matchAll` trên toàn bộ buffer.

**Tham khảo:**
- CWE-1333: https://cwe.mitre.org/data/definitions/1333.html
- OWASP ReDoS: https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS

---

### F-03: Rò rỉ secret vào index (thiếu secret allowlist/denylist)

| Thuộc tính | Giá trị |
|-----------|--------|
| **Mức độ** | 🟡 Medium |
| **OWASP** | A02:2021 — Cryptographic Failures (Sensitive Data Exposure) |
| **CWE** | CWE-200: Exposure of Sensitive Information to an Unauthorized Actor |
| **Vị trí** | `backend/src/engine/parsers/tree-sitter-indexer.ts:45` (`extractAndStoreBodies`), `backend/src/engine/parsers/indexer/storage.ts` & `backend/src/engine/parsers/embedding/body-extractor.ts` (lưu body/symbol không lọc secret) |
| **Trạng thái** | Open |

**Mô tả:**
Engine index **toàn bộ** tên symbol, signature và body code mà **không có cơ chế allowlist/denylist cho secret**. Do đó nội dung mang tính bí mật (hằng `password`, `apiKey`, token, hoặc fixture XML/HTML chứa `<password>secret123</password>`) sẽ bị lưu vào DB và có thể truy xuất qua công cụ search/retrieval sau này. Một test fixture chứa element `<password>` hiện **vẫn bị index** → minh chứng lỗ hổng.

**Tác động:**
Secret hardcoded hoặc dữ liệu nhạy cảm trong source có thể lộ cho bất kỳ ai có quyền truy vấn index (ngay cả khi không có quyền đọc file gốc), mở rộng bán kính (blast radius) khi DB bị compromise.

**Khuyến nghị (Remediation):**
Thêm **secret denylist** (và cho phép cấu hình allowlist element trong grammar config) để loại bỏ symbol/body có tên mang tính bí mật khỏi index:

```typescript
// secret filter — áp dụng trước storeResults / extractAndStoreBodies
const SECRET_DENYLIST = /(password|passwd|pwd|token|secret|api[_-]?key|private[_-]?key|access[_-]?key)/i;

export function shouldIndexSymbol(name: string): boolean {
  return !SECRET_DENYLIST.test(name);
}
// Trong extractSymbols / storage: chỉ push symbol nếu shouldIndexSymbol(name) === true
// Với body: bỏ qua (không lưu embedding) nếu tên symbol cha khớp denylist.
```

Đồng thời bổ sung **test fixture hồi quy**: một tệp fixture chứa `<password>secret123</password>` phải **không xuất hiện** trong kết quả index (search trả về rỗng). Đây là tiền đề cho test case `TC-Secret-Allowlist` (xem mục 5).

**Tham khảo:**
- CWE-200: https://cwe.mitre.org/data/definitions/200.html
- OWASP Sensitive Data Exposure: https://owasp.org/Top10/A02_2021-Cryptographic_Failures/

---

## 4. Detailed Findings — Low & Informational

### L-01 (Low): Log-level misclassification trong grammar-config loader

| Thuộc tính | Giá trị |
|-----------|--------|
| **Mức độ** | 🔵 Low |
| **OWASP** | A09:2021 — Security Logging and Monitoring Failures |
| **CWE** | CWE-778: Insufficient Logging |
| **Vị trí** | `backend/src/engine/parsers/grammars/grammar-config-loader.ts:115` |
| **Trạng thái** | Open |

**Mô tả:** Dòng `logger.error(\`[grammar-config] Loaded: ${config.language} ...\`)` dùng mức **ERROR** để ghi một sự kiện **thành công**. Dù "log hygiene" về secret là đúng (không log credential), việc dùng sai mức độ sẽ gây **noise trong error stream**, dễ làm lu mờ (mask) các lỗi thực sự trong giám sát.
**Khuyến nghị:** Đổi thành `logger.info(...)` cho sự kiện load thành công; chỉ giữ `logger.error` cho các trường hợp thực sự thất bại (như dòng 118).

---

### L-02 (Low): `scanSingleFile` bỏ qua bộ lọc `includeExtensions`/`shouldExclude`

| Thuộc tính | Giá trị |
|-----------|--------|
| **Mức độ** | 🔵 Low |
| **OWASP** | A04:2021 — Insecure Design |
| **CWE** | CWE-710: Improper Adherence to Coding Standards |
| **Vị trí** | `backend/src/engine/indexer/file-scanner.ts:60-78` (scanSingleFile) so với `:127-133` (processFile) |
| **Trạng thái** | Open |

**Mô tả:** `processFile` (dòng 133) kiểm tra `config.includeExtensions` và `shouldExclude`, nhưng `scanSingleFile` chỉ gọi `detectLanguage` rồi index ngay — **không áp dụng** các bộ lọc này. Hậu quả: một tệp được scan đơn lẻ có thể bị index dù nằm ngoài phạm vi include dự kiến → inconsistent scoping.
**Khuyến nghị:** Thống nhất bằng cách gọi chung một hàm `isIndexable(fullPath, config)` (chứa kiểm tra extension + exclude) từ cả `processFile` và `scanSingleFile`.

---

### I-01 (Informational): `timeoutPerFile` chưa thiến trên đường regex fallback

| Thuộc tính | Giá trị |
|-----------|--------|
| **Mức độ** | ℹ️ Informational |
| **Vị trí** | `grammar-config-loader.ts:61` vs `tree-sitter-indexer.ts:58-70` |
| **Trạng thái** | Open |

**Mô tả:** Trường `timeoutPerFile` (mặc định 5000ms) đã được định nghĩa trong `ParserConfig` nhưng **chưa được tham chiếu** trong `regexFallback`. Đây là quan sát bổ trợ cho F-02 — khi đã thiến timeout (như khuyến nghị F-02), cần đảm bảo áp dụng đồng bộ cho cả tree-sitter và regex path.

---

### I-02 (Informational): Grammar config JSON load từ `configDir` thiếu kiểm tra quyền/integritY

| Thuộc tính | Giá trị |
|-----------|--------|
| **Mức độ** | ℹ️ Informational |
| **OWASP** | A05:2021 — Security Misconfiguration |
| **Vị trí** | `grammar-config-loader.ts:96-123` (`loadGrammarConfigs` + `JSON.parse`) |
| **Trạng thái** | Open |

**Mô tả:** Grammar config được load từ `configDir` (đường dẫn tin cậy) bằng `JSON.parse` với kiểm tra hình thái cơ bản. Nếu thư mục config bị ghi bởi user không tin cậy, config độc hại có thể thay đổi hành vi indexing. **Defense-in-depth:** đảm bảo `configDir` chỉ có quyền ghi cho chủ sở hữu dịch vụ (file-permission hardening) và cân nhắc sign/checksum cho các tệp grammar.

---

### I-03 (Informational): `matchAll` trên toàn bộ buffer có thể tối ưu

| Thuộc tính | Giá trị |
|-----------|--------|
| **Mức độ** | ℹ️ Informational |
| **Vị trí** | `signature-extractor.ts:47` (`content.matchAll`) |
| **Trạng thái** | Open |

**Mô tả:** `extractWithPattern` chạy `content.matchAll` cho mỗi pattern trên **toàn bộ nội dung**. Với tệp cho phép lớn nhất (512KB) thì bounded, nhưng có thể tối ưu bằng cách quét theo dòng (line-based) để giảm allocation và dễ kết hợp với `timeoutPerFile`. Không phải lỗ hổng, chỉ là gợi ý robustness/performance.

---

## 5. Kết luận & Phân công (Conclusion & Hand-off)

**Kết luận:** Mức rủi ro tổng thể **LOW**. Các kiểm soát nền tảng (giới hạn `maxFileSize` 512KB, không dùng XML DOM → không XXE, log hygiene đúng, grammar config từ đường dẫn tin cậy, SQL dùng allowlist + parameterized) đã được đánh giá là **đủ tốt và không cần thay đổi thiết kế TDD**.

**Quyết định phân công:**
- 🟰 **SA (Solution Architect):** **KHÔNG cần sửa TDD.** Các finding thuộc về triển khai (implementation hardening), không thay đổi kiến trúc hay hợp đồng thiết kế.
- 🛠️ **DEV:** Xử lý 3 Medium findings thành **test case / unit test** gắn liền với mã nguồn:
  - F-01 → test cho `isWithinWorkspace` (symlink escape bị chặn).
  - F-02 → test ReDoS (pattern tuyến tính + `timeoutPerFile` thiến).
  - F-03 → test secret denylist (fixture `<password>` không bị index).
- 🧪 **QA:** Bổ sung 3 test case vào kế hoạch kiểm thử:
  - **TC-ReDoS** — đưa tệp chứa chuỗi "gần khớp" dài vào indexer, xác nhận parse trả về trong thời gian `timeoutPerFile` (< 5s), không treo.
  - **TC-Secret-Allowlist** — index tệp chứa `<password>secret123</password>` / `const apiKey = "..."`, xác nhận **không** có kết quả tìm kiếm khớp secret.
  - **TC-Symlink-Escape** — đặt symlink trong workspace trỏ ra tệp ngoài (vd `.env` ngoài root), xác nhận indexer **bỏ qua** (containment đúng).

---

## 6. Phụ lục (Appendix)

### A. Phạm vi & giới hạn (Scope Limitations)
- Đây là **design/static review**, không thực hiện dynamic testing / penetration testing / kiểm tra runtime.
- Không đánh giá hạ tầng, mạng, hay cấu hình deploy.
- Các file:line được trích dẫn dựa trên trạng thái mã nguồn tại thời điểm review (2026-08-27).

### B. Phương pháp (Methodology)
- Đọc và phân tích tĩnh (manual code review) các module `backend/src/engine/`.
- Đối chiếu với OWASP Top 10 (2021) và CWE.
- Tham khảo các pattern phòng thủ đã có trong repo (vd `realpath` + containment ở `jira-attachment-tools.ts`).

### C. Bảng tóm tắt findings
| ID | Tiêu đề | Mức độ | OWASP |
|----|---------|--------|-------|
| F-01 | Symlink containment thiếu khi đọc tệp | Medium | A01 |
| F-02 | ReDoS ở parser regex mới | Medium | A04 |
| F-03 | Rò rỉ secret vào index (thiếu allowlist) | Medium | A02 |
| L-01 | Log-level sai (ERROR cho sự kiện thành công) | Low | A09 |
| L-02 | `scanSingleFile` bỏ qua bộ lọc include/exclude | Low | A04 |
| I-01 | `timeoutPerFile` chưa thiến trên regex path | Info | A04 |
| I-02 | Grammar config thiếu hardening quyền tệp | Info | A05 |
| I-03 | `matchAll` toàn buffer có thể tối ưu | Info | — |
