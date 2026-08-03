# Review-05 — Gap Analysis: Hiện trạng Code vs Kiến trúc Mục tiêu SA4E-85 (Section 6)

> **Mục đích:** Đối chiếu **code hiện tại** (thực tế trong repo) với **Kiến trúc mục tiêu
> Backend-Driven Knowledge Architecture** được mô tả tại Section 6 của
> `Review-05-updated.md`, xác định chính xác những gì còn thiếu và phải làm.
>
> **Phạm vi:** Chỉ phân tích gap theo kiến trúc, không đánh giá code quality.
>
> **Kết luận ngắn:** Kiến trúc hiện tại **lưu state ở phía client (Extension Host)** và
> **chưa có Knowledge Service/Checkpointer trên Backend**. Mục tiêu Section 6 chưa được
> implement — cần ~5 hạng mục P0 mới đạt được trạng thái mục tiêu.

---

## 1. Trạng thái hiện tại (Verified from code)

| Hạng mục | Vị trí thực tế | File | Mô tả |
|---|---|---|---|
| LangGraph Runtime | **Extension Host** | `extension/src/langgraph/engine/langgraph-engine.ts` | Khởi tạo graph + checkpointer trong quá trình VS Code extension |
| Checkpointer | **Workspace JSON (client)** | `extension/src/langgraph/core/checkpointer.ts` | `WorkspaceCheckpointer extends BaseCheckpointSaver` ghi JSON vào `.vscode/kiro-pipeline-state/{threadId}.json` |
| Session | **File cục bộ (client)** | `extension/src/chat/engine/SessionManager.ts` | Ghi `thread_id` vào `.code-intel/.run/session.json`, cleanup khi deactivate |
| Chat Engine | **Extension Host** | `extension/src/chat/engine/ChatEngineAdapter.ts` | Điều phối stream, approval, session |
| Backend HTTP | **Có** | `backend/src/server/HttpServer.ts` | Hono server: health, tools, api, admin, MCP, KB API |
| Backend KB API | **Có (chỉ memory/code/context)** | `backend/src/server/routes/kb-api.ts` | `memory/search`, `memory/ingest`, `code/search`, `context/curated`, `admin/status` — **KHÔNG có threads/messages/checkpoints** |
| Hydration API (`SYNC_CHAT_HISTORY`) | **CHƯA CÓ** | — (chỉ trong FSD/TDD v3.0) | Không tìm thấy trong code `extension/src` |
| Knowledge Service (backend) | **CHƯA CÓ** | — | Không có class `KnowledgeService` trong backend |
| LangGraph Checkpointer trên Backend | **CHƯA CÓ** | — | Backend không có endpoint thread/checkpoint |

---

## 2. Bảng Gap Analysis — Mục tiêu vs Hiện trạng

### 2.1. Mục tiêu P0 (Section 6.3)

| # | Mục tiêu Section 6 | Hiện trạng | Gap | Công việc cần làm |
|---|---|---|---|---|
| P0-1 | **Backend Knowledge Service** — nguồn dữ liệu duy nhất cho Threads, Messages, Checkpoints, Long-term Memory, Tool Executions, Artifacts, Event History, Agent Registry | Không có. Backend chỉ có memory/code/context KB API (chỉ đọc tool handlers) | **100%** | Xây service module mới: `backend/src/knowledge/` (repository + service + schema). Phân định entity: Thread, Message, Checkpoint, ToolExecution, Artifact, Event, Agent. **Checkpoint endpoints là API của service này** (RemoteCheckpointer sẽ gọi tới) |
| P0-2 | **KB Checkpointer** thay cho Client State — LangGraph đọc/ghi checkpoint qua Knowledge Service | `WorkspaceCheckpointer` ghi JSON client-side vào `.vscode/kiro-pipeline-state/` | **100%** | **[QUYẾT ĐỊNH]** Giữ LangGraph Runtime ở Extension Host. Implement `BaseCheckpointSaver` mới `RemoteCheckpointer` gọi Backend KB qua HTTP (`GET/PUT /api/v1/threads/:id/checkpoint`) — thay thế toàn bộ `WorkspaceCheckpointer` |
| P0-3 | **Stateless Extension Host** — thin proxy, không cache conversation | Extension Host giữ ChatEngineAdapter, SessionManager (ghi file), WorkspaceCheckpointer | **90%** | Bỏ SessionManager file-based → chỉ giữ `thread_id` trong-memory hoặc query backend. ChatEngineAdapter vẫn chạy graph local (theo quyết định) nhưng state đọc/ghi qua `RemoteCheckpointer` → Backend. Loại bỏ write file `.code-intel/.run/session.json` |
| P0-4 | **Stateless Svelte Webview** — chỉ render từ backend hydration | Webview đã là client render thuần (mirror của message events từ `messageListener.ts`) | **40%** | Giữ nguyên phần render. Cần thêm cơ chế hydrate lại toàn bộ `thread_id` khi mở (hiện chưa có `SYNC_CHAT_HISTORY`), và xoá cache cục bộ nếu có |

### 2.2. Mục tiêu P1 (Section 6.3)

| # | Mục tiêu Section 6 | Hiện trạng | Gap | Công việc cần làm |
|---|---|---|---|---|
| P1-1 | **Multi-IDE Hydration từ KB** (VSCode, Kiro, AntiGravity cùng `thread_id`) | Chỉ VSCode. SessionManager có comment "future: multi-IDE via FileSystemWatcher" nhưng chưa implement | **100%** | REST/WS hydration API: `GET /api/v1/threads/:id`, `GET /api/v1/threads/:id/messages`, `POST /api/v1/threads/:id/resume`. Xác thực theo IDE client |
| P1-2 | **Event Sourcing** — mọi thay đổi state là event append-only | Không có. Checkpoint JSON ghi đè full state | **100%** | Thiết kế event table (event_id, thread_id, type, payload, seq, timestamp). Checkpoint là projection từ event stream. Rebuild/hydrate từ event log |
| P1-3 | **Artifact Store** — lưu artifacts (diff, diagrams, docs) | Diff được render live qua `OpenCodeToolHandler`/`WorkspaceEdit`, không persist artifact độc lập | **100%** | Backend storage cho artifacts theo thread. API upload/download/versioning. Diff, drawio, kết quả tool exec → artifact |

### 2.3. Mục tiêu P2 (Section 6.3)

| # | Mục tiêu Section 6 | Hiện trạng | Gap | Công việc cần làm |
|---|---|---|---|---|
| P2-1 | **Capability-based Permission Model** | Có `ToolApprovalGate` + `ToolApprovalClassifier` (dangerous/safe list) nhưng nằm ở Extension Host, không có capability registry backend | **80%** | Chuyển rule approval sang backend (capability grant theo tool/agent/user). Extension chỉ hiển thị prompt + quyết định |
| P2-2 | **Versioned IPC Protocol** | `types/messages.ts` dùng union type string (`STREAM_*`, `TOOL_*`, `CONTEXT_*`, `SYNC_*`) không có version field | **70%** | Thêm `protocolVersion` vào envelope + negotiation giữa webview ↔ host ↔ backend |

---

## 3. Đối chiếu mâu thuẫn tài liệu

**Mâu thuẫn đã xác định:** FSD v3.0 (BR-30) + TDD v3.0 ghi *"LangGraph Checkpointer = SoT, lưu tại SQLite `database/chat_history.db`"*, trong khi Section 6.2 Review-05-updated ghi *"Không sử dụng SQLite Checkpointer cục bộ làm nguồn dữ liệu chính"*.

**Đề xuất thống nhất:** Chọn **Backend KB (Knowledge Service) làm SSOT** như Section 6 — phù hợp yêu cầu Multi-IDE. SQLite Checkpointer (nếu dùng) chỉ là *persistence layer phía backend* của Knowledge Service, không phải nguồn dữ liệu client. Cần cập nhật FSD v3.0/TDD v3.0 để đồng bộ (BR-30 rewrite).

---

## 4. Phụ thuộc & Thứ tự thực hiện

> **Quyết định kiến trúc (2026-08-02):** Giữ **LangGraph Runtime ở Extension Host**, dùng **Remote Checkpointer qua HTTP** gọi Backend Knowledge Service. Không di chuyển LangGraph lên backend.

```text
P0-1 Backend Knowledge Service (nền tảng, làm trước — gồm Checkpoint REST API)
   └─> P0-2 RemoteCheckpointer (extension, HTTP → Backend; thay WorkspaceCheckpointer)
        └─> P1-2 Event Sourcing (song song/trong Knowledge Service)
P0-3 Stateless Extension Host (cần P0-2)
P0-4 Stateless Webview + Hydration (cần P0-2)
P1-1 Multi-IDE Hydration API (cần P0-1, P0-2)
P1-3 Artifact Store (cần P0-1)
P2-1 Capability Permission (độc lập, có thể sau)
P2-2 Versioned IPC (độc lập)
```

---

## 5. Tóm tắt mức độ đạt

| Hạng mục mục tiêu | % đạt hiện tại |
|---|---|
| Backend Knowledge Service (P0-1) | **0%** |
| KB Checkpointer (P0-2) | **0%** |
| Stateless Extension Host (P0-3) | **10%** |
| Stateless Webview (P0-4) | **60%** |
| Multi-IDE Hydration (P1-1) | **0%** |
| Event Sourcing (P1-2) | **0%** |
| Artifact Store (P1-3) | **0%** |
| Capability Permission (P2-1) | **20%** |
| Versioned IPC (P2-2) | **30%** |

**Kiến trúc mục tiêu hiện đạt ~13%** — toàn bộ phần lõi (Knowledge Service, KB Checkpointer, Event Sourcing, Hydration API) chưa tồn tại trong code. Các phần UI (webview render, stream, approval UX) là nền tảng tốt để xây lên.

---

## 6. Hành động đề xuất

1. **Ưu tiên P0-1** — xây `backend/src/knowledge/` (entity + repository + service, gồm Checkpoint REST API) là bước bắt buộc đầu tiên, mọi hạng mục P0/P1 phụ thuộc.
2. **LangGraph Runtime giữ ở Extension Host** [QUYẾT ĐỊNH] — chỉ thay `WorkspaceCheckpointer` bằng `RemoteCheckpointer` (HTTP → Backend). Tránh thay đổi graph/engine hiện tại.
3. **Đồng bộ tài liệu** — cập nhật FSD/TDD v3.0 (BR-30) theo hướng KB = SSOT để hết mâu thuẫn với Section 6.
4. **Giữ nguyên** phần chat engine/UI đã có (stream, approval, diff) — chúng chỉ cần đổi nguồn state sang backend, không phải viết lại.
