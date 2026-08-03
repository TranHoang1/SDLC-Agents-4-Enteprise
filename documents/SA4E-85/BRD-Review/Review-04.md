# Review-04 — Đánh giá mức độ tuân thủ (Compliance) code SA4E-85 theo chuẩn opencode

> **Đối tượng review:** Code SA4E-85 (ToolApprovalGate + ApprovalEventLog + wiring):
> `extension/src/chat/engine/ToolApprovalGate.ts`, `ApprovalEventLog.ts`, `ApprovalGateTypes.ts`,
> `extension/src/langgraph/subgraphs/chat-graph-nodes.ts`, `chat-graph.ts`, `ChatEngineAdapter.ts`, `index.ts`.
>
> **Chuẩn tham chiếu:** https://github.com/anomalyco/opencode (AGENTS.md + Style Guide — repo opencode hiện tại).
> Lưu ý: `opencode-ai/opencode` đã archive từ 09/2025 (Go CLI); chuẩn hiện hành lấy từ `anomalyco/opencode`.
>
> **Kết quả trước (v1):** ~63% compliant
> **Kết quả sau hardening (v3):** **~72% compliant** (+9%)

---

## 1. Tổng quan

Code ToolApprovalGate v3 được cải thiện đáng kể: tách types ra file riêng (SRP), idempotency guard,
retry mechanism, JSONL audit log, escalation timer. Tuy nhiên vẫn còn vi phạm opencode style:
`import * as` trong ApprovalEventLog, over-commenting (JSDoc trên private helpers),
và thiếu config-driven permission system (opencode dùng pattern matching declarative).

---

## 2. Phân tích theo từng rule của opencode AGENTS.md

| # | Rule (chuẩn anomalyco/opencode) | Điểm trước | Điểm sau | Bằng chứng thay đổi |
|---|---|---|---|---|
| 1 | **Conventional commits** | 55 | 55 | Chưa commit — chưa đánh giá lại |
| 2 | **Avoid `any` type** | 40 | 65 | ToolApprovalGate: 0 `any`. ApprovalEventLog: 0 `any`. ApprovalGateTypes: 0 `any`. Nhưng `chat-graph-nodes.ts:255,261` vẫn dùng `as any` cho emitDirect |
| 3 | **Never star imports** | 35 | 45 | ToolApprovalGate: chỉ type imports. Nhưng `ApprovalEventLog.ts:8-9` vẫn `import * as fs` + `import * as path` |
| 4 | **Prefer `const`, early return, no `else`** | 90 | 95 | Toàn bộ Gate + Log dùng early return, `const`, no else |
| 5 | **One function / happy-path + helpers** | 80 | 90 | Mỗi method ≤20 dòng. Private helpers tách rõ dưới public API |
| 6 | **Rely on type inference** | 50 | 70 | Ít annotation thừa hơn. `let resolve!:` vẫn cần explicit type (acceptable) |
| 7 | **Avoid `try`/`catch` khi có thể** | 70 | 80 | ApprovalEventLog dùng try/catch nhưng best-effort (silent) — đúng pattern opencode cho I/O |
| 8 | **Comments chỉ cho điều không-hiển-nhiên** | 40 | 50 | Vẫn có header `SA4E-85 — ...` và JSDoc trên private helpers. Nhưng ít noise hơn trước |
| 9 | **Testing thật, tránh mock** | 70 | 85 | 40 tests pass. ApprovalEventLog test dùng real fs (tmpdir). ToolApprovalGate dùng `vi.useFakeTimers()` (acceptable cho timing) |
| 10 | **Module style nhất quán** | 60 | 75 | Tất cả files mới dùng ESM `import/export` nhất quán. Không `require()` |
| 11 | **Branch ngắn** | 85 | 85 | Vẫn `SA4E-85` |

**Điểm weighted (chỉ code mới):**
- no-any: 65 · imports: 45 · const/early-return: 95 · hàm đơn: 90 · inference: 70 · try/catch: 80 · comments: 50 · testing: 85 · module-style: 75

**→ ≈72% compliant** (tăng từ 63%)

---

## 3. Cải thiện so với Review-04 v1

| # | Issue trước | Trạng thái | Chi tiết |
|---|---|---|---|
| 1 | Thiếu regression test cho approval flow | ✅ Fixed | 40 tests: 28 unit + 8 event-log + 4 integration |
| 2 | Over-commenting | ⚠️ Partial | Bớt noise nhưng vẫn JSDoc trên private helpers |
| 3 | `any` cast | ⚠️ Partial | Gate/Log clean, nhưng `chat-graph-nodes.ts` emitDirect vẫn cast |
| 4 | Star imports | ⚠️ Partial | Gate clean (type imports only), nhưng `ApprovalEventLog` vẫn `import * as fs/path` |
| 5 | Module style trộn | ✅ Fixed | Tất cả files mới pure ESM |

---

## 4. Vi phạm còn lại (ưu tiên khắc phục)

### 4.1. `import * as` trong ApprovalEventLog.ts
```typescript
// ❌ Vi phạm "Never use star imports"
import * as fs from 'node:fs';
import * as path from 'node:path';

// ✅ Nên đổi thành:
import { appendFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
```

### 4.2. `as any` cast trong chat-graph-nodes.ts
```typescript
// ❌ line 255, 261
sh.emitDirect({ type: "chat:toolCallUpdate", ... } as any);
```
→ Cần typed interface cho `StreamHandler.emitDirect()` params.

### 4.3. Over-commenting — JSDoc trên private helpers
```typescript
// ❌ Không cần JSDoc cho helper rõ nghĩa
/** Clear both timers for a pending entry */
private clearTimers(entry: PendingApproval): void { ... }

/** Notify external listener of pending set changes */
private notifyStateChange(): void { ... }
```
→ Opencode rule: "Comments only for non-obvious things." Tên method đã đủ rõ.

### 4.4. Header comment `SA4E-85 — ...` trên mỗi file
→ Opencode không dùng ticket prefix headers. Thông tin ticket thuộc về commit message, không source code.

---

## 5. So sánh kiến trúc với opencode permission system

| Khía cạnh | anomalyco/opencode | SA4E-85 (của chúng ta) | Gap |
|---|---|---|---|
| **Approach** | Declarative config (opencode.json) | Imperative Promise gate | Architecture ≠ |
| **Rules engine** | Wildcard pattern matching (`"git *": "allow"`) | Static `ReadonlySet` hardcoded | ❌ Major gap |
| **3-tier decision** | `allow / ask / deny` | `approve / reject` (2 tier) | ❌ Missing "allow" auto-approve |
| **Session memory** | "Always" → saves pattern for session | Không có | ❌ Missing |
| **Persistence** | SQLite (`PermissionSaved` table) | JSONL file + `onStateChange` callback | ⚠️ Different but functional |
| **Doom loop detect** | Same tool 3x → auto-ask | Không có | ❌ Missing |
| **Auto mode** | `--auto` flag bypasses all "ask" | Không có | ❌ Missing |
| **Per-agent rules** | Agent-scoped permission overrides | N/A (single agent context) | N/A |
| **Retry** | Không có | ✅ `retryApproval()` max 3 | We're ahead |
| **2-phase escalation** | Không có | ✅ `onEscalation` callback | We're ahead |
| **Metrics** | Không có | ✅ `getMetrics()` | We're ahead |
| **JSONL audit log** | Không có (uses SQLite) | ✅ `ApprovalEventLog` | We're ahead |

**Kiến trúc compliance: ~62%** (vì approach khác biệt cơ bản — declarative vs imperative)
**Code style compliance: ~72%** (cải thiện so với 63% trước)
**Combined: ~67%**

---

## 6. Hành động khuyến nghị

| Ưu tiên | Hành động | Ảnh hưởng | Effort |
|---|---|---|---|
| P0 | Đổi `import * as fs/path` → named imports trong ApprovalEventLog | +imports (45→80) | 5 min |
| P0 | Bỏ JSDoc trên private helpers (`clearTimers`, `notifyStateChange`, etc.) | +comments (50→70) | 5 min |
| P0 | Bỏ header `SA4E-85 — ...` trên files | +comments | 5 min |
| P1 | Type `emitDirect` params properly thay vì `as any` | +no-any (65→80) | 30 min |
| P1 | Add configurable rules (wildcard patterns thay vì hardcoded Set) | +architecture compliance | 2h |
| P1 | Add "always approve for session" memory | +architecture compliance | 1h |
| P2 | Add doom loop detection (3x identical → ask) | +architecture compliance | 30 min |
| P2 | Add `autoApprove` constructor option | +architecture compliance | 15 min |

**Nếu implement P0 (15 min):** 72% → ~78%
**Nếu implement P0 + P1 (3.5h):** 72% → ~88%
**Nếu implement all (5h):** 72% → ~95%

---

## 7. Kết luận

Code SA4E-85 sau hardening (v3) cải thiện rõ rệt về code quality (+9% từ 63→72%). Tuy nhiên
**kiến trúc permission** khác biệt cơ bản với opencode: chúng ta dùng imperative Promise gate
(phù hợp cho VSCode extension in-process), trong khi opencode dùng declarative config engine
(phù hợp cho CLI/TUI server-client).

Đạt 100% opencode compliance sẽ yêu cầu refactor toàn bộ approach sang declarative — đó là
architecture change, không phải bug fix. Recommend: implement P0 quick wins (15 min) để đạt ~78%,
rồi evaluate P1 trong ticket riêng.

---

*Ngày review: 2026-08-02 · Cập nhật: v2 (sau hardening) · Người review: Agent*
*Tham chiếu: https://github.com/anomalyco/opencode*
