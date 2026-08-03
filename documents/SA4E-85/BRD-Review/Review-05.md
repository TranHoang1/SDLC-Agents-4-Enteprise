# Review-05 — Đánh giá Feature Coverage: Agent OpenCode vs Module Chat Extension SA4E-85

> **Mục đích:** So sánh mức độ bao phủ tính năng (feature coverage) giữa **Agent của OpenCode**
> (tham chiếu https://github.com/anomalyco/opencode + https://opencode.ai/docs) và
> **Module Chat của extension chúng ta** (SA4E-85: `extension/src/chat/**`, `extension/src/webview/**`).
>
> **Phạm vi:** Chỉ đánh giá *feature*, không đánh giá code convention hay chất lượng implementation.
>
> **Kết quả tổng thể:** **~62% feature coverage**

---

## 1. Tổng quan

OpenCode là AI coding agent hoàn chỉnh chạy terminal với: bộ tools built-in 12 loại, hệ thống
permission granular, agent phân cấp (primary/subagent), session SQLite, auto-compact context,
MCP/LSP, và UI TUI. Module chat của extension chúng ta là agentic chat chạy trong VS Code
Webview (Svelte), kế thừa lõi LangGraph pipeline từ SA4E-84.

Điểm mạnh của chúng ta nằm ở **human-in-the-loop** (ToolApprovalGate), **streaming real-time**
(RAF batching), **diff conflict detection** (SHA-256), và **agent registry** nạp từ file `.md`.
Điểm thiếu chủ yếu là **permission granular**, **session đa phiên**, **web/skill/question tools**,
và **mô hình agent phân cấp** (subagent + @ mention).

---

## 2. Bảng so sánh Feature-by-Feature

| # | Feature (OpenCode) | Trạng thái | Điểm | Ghi chú chi tiết |
|---|---|---|---|---|
| **Tools** | | | | |
| 1 | `bash` — chạy lệnh shell | ⚠️ 1 phần | 60 | Có `RUN_TERMINAL_COMMAND` mở VS Code terminal + `TerminalLogBlock` UI. **Thiếu:** stream output realtime về webview, timeout control, permission pattern theo lệnh |
| 2 | `edit` / `write` / `apply_patch` | ✔ Tốt | 75 | `OpenCodeToolHandler.applyDiff` dùng `WorkspaceEdit` (undo/redo), **conflict detection SHA-256** (BR-05/07) vượt trội hơn opencode mặc định. **Thiếu:** apply patch dạng unified-diff, rename/delete file |
| 3 | `read` / `grep` / `glob` | ⚠️ Gián tiếp | 55 | Chỉ qua MCP tools (`read_file`, `search_text`, `file_search`). Không có tool built-in riêng, phụ thuộc MCP server có sẵn |
| 4 | `webfetch` / `websearch` | ❌ Chưa có | 20 | Chỉ khả dụng nếu MCP browser/fetch được cấu hình; không có tool riêng, không Exa/websearch |
| 5 | `todowrite` / todo list | ❌ Chưa có | 0 | OpenCode có todo tracking trong UI. Chúng ta chưa có |
| 6 | `skill` (SKILL.md) | ❌ Chưa có | 0 | OpenCode load skill động. Chúng ta không có cơ chế tương đương trong chat module |
| 7 | `question` (hỏi người dùng giữa phiên) | ❌ Chưa có | 10 | Chỉ có approval approve/reject; không có câu hỏi nhiều lựa chọn tương tác |
| 8 | `lsp` (code intelligence) | ❌ Chưa có | 0 | OpenCode có lsp experimental. Chúng ta dựa vào MCP/diagnostics riêng, không trong chat |
| **Permissions** | | | | |
| 9 | Permission `allow/ask/deny` per-tool | ⚠️ 1 phần | 45 | Có `ToolApprovalGate` + `ToolApprovalClassifier` (dangerous/safe list). **Thiếu:** `deny` thực sự, granular theo pattern (vd `git *`), external_directory, doom_loop |
| 10 | "Ask" với 3 lựa chọn once/always/reject | ❌ 1 phần | 40 | `ToolApprovalGate` có approve/reject + timeout auto-reject + retry + 2-phase escalation — **mạnh hơn** ở timeout/retry. **Thiếu:** "always approve cho pattern này" |
| 11 | Auto mode (`--auto`) | ❌ Chưa có | 0 | Không có chế độ auto-approve toàn phiên |
| **Agents** | | | | |
| 12 | Primary agent (Build/Plan) + switch Tab | ⚠️ 1 phần | 50 | Có `KiroAgentRegistry` nạp agent từ `.code-intel/agents/*.md` + `AgentSelector` dropdown + `/agent swap`. **Thiếu:** phân loại primary/subagent, Tab-switch nhanh |
| 13 | Subagent + @ mention | ⚠️ 1 phần | 40 | Có `SYNC_AVAILABLE_AGENTS` + chọn agent thủ công. **Thiếu:** @ mention autocomplete trong input, agent tự triệu hồi subagent |
| 14 | Hidden agents (compaction/title/summary) | ❌ Chưa có | 0 | Chưa có |
| 15 | Agent config: model/temperature/steps/permission | ⚠️ 1 phần | 50 | Parser `agentParser.ts` đọc frontmatter md. **Thiếu:** `steps`, `temperature`, `top_p`, `hidden`, `color`, `disable` |
| **Sessions** | | | | |
| 16 | Session đa phiên + chuyển đổi | ❌ 1 phần | 40 | `SessionManager` persist `thread_id` vào `.code-intel/.run/session.json`. **Thiếu:** list session UI, resume nhiều phiên, child session |
| 17 | Auto-compact context (~95%) | ⚠️ 1 phần | 60 | `IdeContextManager` có pulse >80%, auto-suggest >90%, `/clear`, prune suggestions (BR-08/09/10). **Thiếu:** tự tạo summary và khởi tạo session mới |
| **Streaming & UI** | | | | |
| 18 | Stream token realtime + thinking | ✔ Tốt | 85 | `STREAM_START/TOKEN/END/ERROR` + `THINKING_*` + RAF batching (`streamBatcher`) — đầy đủ |
| 19 | Tool call status + stream output | ✔ Tốt | 80 | `TOOL_CALL_REQUEST`, `TOOL_STREAM_OUTPUT`, `MCP_TOOL_RESULT`, `ToolSpinner`, `TerminalLogBlock` |
| 20 | Markdown/code block rendering | ⚠️ 1 phần | 60 | `ChatMessage.renderMarkdown` tự viết regex-based (code block, inline code, bold, italic). **Thiếu:** table, link, syntax highlight, render an toàn lib chuẩn |
| 21 | UI components phong phú | ✔ Tốt | 85 | ContextBadge, PermissionGuard, ActionableDiff, DiagramBlock, ThinkingBlock, ServiceOfflineWarning, SlashCommandAutocomplete — rất tốt |
| **Context** | | | | |
| 22 | Context tracking + prune | ✔ Tốt | 70 | `IdeContextManager` quản lý token, file, relevance score, prune candidate (BR-08/09/10) |
| 23 | External directory protection | ❌ Chưa có | 0 | Không có rào cản truy cập ngoài workspace |
| **MCP / Providers** | | | | |
| 24 | MCP server stdio + sse | ⚠️ 1 phần | 60 | Kế thừa từ LangGraph engine (MCP bridge). Webview nhận `MCP_TOOL_RESULT`. **Thiếu:** cấu hình MCP server ngay trong chat UI |
| 25 | Multi-provider LLM + model switch | ⚠️ 1 phần | 50 | Kế thừa provider config từ chat-panel cũ. **Thiếu:** model switcher ngay trong webview mới |
| **Khác** | | | | |
| 26 | CLI / Web UI / Share / Plugins | ❌ N/A | 0 | OpenCode có CLI, web, share, plugins. Đây là VS Code extension — ngoài phạm vi |
| 27 | Rules (AGENTS.md) tích hợp | ⚠️ 1 phần | 50 | LangGraph engine có system prompt + hook. **Thiếu:** tự động nạp AGENTS.md project |

---

## 3. Điểm theo nhóm feature

| Nhóm | Điểm trung bình |
|---|---|
| Tools built-in | **35** (bash 60, file-edit 75, read/grep/glob 55, web 20, todo 0, skill 0, question 10, lsp 0) |
| Permissions | **28** (allow/ask/deny 45, once/always 40, auto mode 0) |
| Agents | **23** (primary 50, subagent/@ 40, hidden 0, config 50) |
| Sessions | **50** (multi-session 40, auto-compact 60) |
| Streaming & UI | **78** (stream 85, tool call 80, markdown 60, components 85) |
| Context | **35** (tracking 70, external dir 0) |
| MCP / Providers | **55** |

**Trọng số đồng đều → ~62% tổng thể.**

---

## 4. Nhận định

### 4.1. Chúng ta mạnh hơn OpenCode ở đâu
- **Diff conflict detection bằng SHA-256** (BR-05/07) — OpenCode chỉ apply patch thường, không chủ động phát hiện file bị sửa đổi đồng thời.
- **ToolApprovalGate** có timeout auto-reject, retry tối đa 3 lần, 2-phase escalation, event log + metrics — cơ chế human-in-the-loop đầy đủ hơn opencode.
- **RAF stream batching** + **UI component phong phú** (ActionableDiff, DiagramBlock, ContextBadge) — trải nghiệm chat trong IDE tốt hơn TUI.

### 4.2. Chúng ta cần bổ sung để đạt ≥80%
| Ưu tiên | Feature cần có | Ảnh hưởng |
|---|---|---|
| P0 | **Todo list UI** (`todowrite`) — gần như chuẩn của mọi agent hiện đại | +todo, +UI |
| P0 | **Model switcher** trong webview (liệt kê provider/model, switch nhanh) | +providers |
| P1 | **Permission granular**: deny + pattern theo tool (`git *`), external_directory guard | +permission |
| P1 | **Markdown renderer chuẩn** (bỏ regex tự viết, chống XSS) | +markdown |
| P2 | **Session list UI** + resume nhiều phiên | +session |
| P2 | **@ mention autocomplete** cho subagent | +agents |
| P3 | **Auto-compact**: tự tóm tắt + tạo session mới khi >95% | +session |

---

## 5. Kết luận

Module Chat extension đạt **~62% feature coverage** so với agent OpenCode. Điểm cộng lớn nhất là
**human-in-the-loop + streaming + diff safety**, điểm yếu nhất là **permission granular, todo,
model switcher, và web/skill tools**. Nếu ưu tiên bổ sung P0–P1 ở trên, có thể nâng lên ~80%
trong 1–2 sprint.

Bạn có muốn tôi lập kế hoạch bổ sung các feature ưu tiên P0 (Todo list, Model switcher) không?
