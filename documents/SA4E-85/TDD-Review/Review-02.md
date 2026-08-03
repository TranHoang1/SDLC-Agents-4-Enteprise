Dưới đây là bản **TDD (Technical Design Document) Phiên bản 3.0** đã được cập nhật toàn diện, bao gồm kiến trúc Backend-Driven State, cơ chế Hydration cho Multi-IDE, Pub/Sub Broadcasting, và danh sách các thay đổi cần thiết cho LangGraph Backend.

> ## ⚠️ [v3.1] CẬP NHẬT KIẾN TRÚC — Review-05
>
> Bản TDD **3.0 dưới đây đã được thay thế** theo quyết định **Backend-Driven Knowledge (v3.1)**
> trong `documents/SA4E-85/BRD-Review/Review-05-Gap-Analysis.md`. Tài liệu **chính thức hiện hành**
> là `documents/SA4E-85/TDD.md` (v3.1). Các thay đổi khác biệt so với TDD 3.0:
>
> - **LangGraph Runtime GIỮ ở Extension Host** (in-process), KHÔNG tách thành Backend (Python/Node) riêng
> - **SQLite Checkpointer KHÔNG còn là nguồn chính** — thay bằng **Backend Knowledge Service** (KB = SSOT) + `RemoteCheckpointer` (HTTP)
> - **session.json KHÔNG còn là nguồn state** — `thread_id` resolve từ Backend KB
> - `LangGraphOrchestrator` (mục 2.6 dưới đây) được thay thế bởi `BackendKnowledgeService` + `RemoteCheckpointer`
> - `interrupt()`/`resume` vẫn giữ, nhưng checkpoint đọc/ghi qua RemoteCheckpointer → Backend KB
>
> Nội dung dưới đây giữ nguyên để phục vụ lịch sử review. Đọc TDD.md v3.1 để lấy spec hiện hành.

# Technical Design Document (TDD)

## SDLC Agents 4 Enterprise — SA4E-85: Nâng cấp Chat UI Agentic - Svelte Webview

---

## Document Information

| Field | Value |
| --- | --- |
| Jira Ticket | SA4E-85

 |
| Title | Nâng cấp Chat UI Agentic - Svelte Webview

 |
| Author | SA Agent

 |
| Version | 3.0 |
| Date | 2026-08-02 |
| Status | Approved |
| Related FSD | FSD-v3-SA4E-85.md |
| Related BRD | BRD-v2-SA4E-85.docx

 |

---

## Revision History

| Version | Date | Author | Changes |
| --- | --- | --- | --- |
| 1.0 | 2026-08-01 | SA Agent | Initial TDD from FSD v2

 |
| 2.0 | 2026-08-02 | SA Agent | Incorporate TDD-Review-01: token buffering, diagram skin constraints, WebSocket dispose lifecycle

 |
| 3.0 | 2026-08-02 | SA Agent | Chuyển đổi kiến trúc sang **Backend-Driven State**, LangGraph Checkpointer, Hydration API, và Pub/Sub Broadcasting cho Multi-IDE. Thêm Phase 0 vào lộ trình. |

---

## 1. Architecture Overview

### 1.1 Design Philosophy

* **Backend-Driven State (Single Source of Truth):** LangGraph Checkpointer (Backend) là nguồn lưu trữ sự thật duy nhất. Svelte Webview Stores chỉ là "gương phản chiếu" (Mirror) để render giao diện.
* **Multi-IDE Interoperability:** Quản lý phiên làm việc thông qua `thread_id` dùng chung, cho phép VSCode, Kiro IDE và AntiGravity đồng bộ thời gian thực.
* **Layered Architecture**: 3-tier (Webview Client → Extension Host Hub → LangGraph Backend).


* **Message-Driven**: Cross-boundary communication via typed messages.


* **Fail-Safe**: Graceful degradation when external services unavailable.



### 1.2 Technology Stack

| Layer | Technology | Constraint |
| --- | --- | --- |
| Webview UI | Svelte 4 + Vite 5

 | Bundle ≤15KB gzipped

 |
| State | Svelte writable/derived stores

 | Mirror Data from Backend |
| Extension Host | TypeScript (Node.js)

 | Activation <200ms

 |
| **Backend Orchestrator** | **LangGraph (Python/Node.js)** | **Hỗ trợ `interrupt` (Human-in-the-loop)** |
| **State Database** | **SQLite Checkpointer** | **Lưu tại `.code-intel/database/chat_history.db**` |
| IPC External | WebSocket + JSON-RPC 2.0

 | Pub/Sub Broadcasting cho Multi-IDE |
| Agent Config | .code-intel/agents/*.md

 | YAML frontmatter

 |

### 1.3 Communication Patterns

| Boundary | Protocol | Direction |
| --- | --- | --- |
| Webview ↔ Extension Host | postMessage (JSON)

 | Bidirectional

 |
| Extension Host ↔ LangGraph | **Stream & Suspend/Resume** | **Gửi query → Stream → Freeze → Resume** |
| Extension Host ↔ Kiro/AntiGravity | WebSocket JSON-RPC 2.0

 | **Pub/Sub Sync / Bidirectional** |

---

## 2. Module Design

### 2.1 MessageRouter.ts

**Responsibility:** Central dispatcher định tuyến postMessage. Quản lý Token Buffering để tối ưu I/O.

* **Token Buffering:** Gom các token `STREAM_TOKEN` trong bộ đệm (16-50ms) trước khi gửi `postMessage` xuống Webview để duy trì 60fps, tránh nghẽn cổ chai. Buffer flush khi: hết timer, gặp `STREAM_END`, hoặc size > 256 bytes.



### 2.2 KiroAgentRegistry.ts

**Responsibility:** Quét `.code-intel/agents/*.md`, parse YAML, duy trì registry với hot-reload qua FileSystemWatcher.

### 2.3 OpenCodeToolHandler.ts

**Responsibility:** Xử lý WorkspaceEdit, kiểm tra mã băm SHA-256 (Concurrent Modification), và giao tiếp với LangGraph Checkpointer.

* **Resume Graph Integration:** Khi User Accept/Reject, module không resolve Promise cục bộ mà gửi tín hiệu `Resume` (kèm Thread ID và Status) thẳng về LangGraph Backend để đánh thức (wake-up) đồ thị.

### 2.4 IpcBridge.ts

**Responsibility:** Quản lý WebSocket JSON-RPC 2.0, Auto-reconnect.

* **Pub/Sub Broadcasting:** Cung cấp cơ chế phân phối tín hiệu streaming đồng thời lên tất cả các kết nối IDE (VSCode, AntiGravity, Kiro) đang mở chung một `thread_id`.
* **Lifecycle Management (CRITICAL):** Bắt buộc gọi `IpcBridge.dispose()` thông qua `ExtensionContext.subscriptions[]` để tránh rò rỉ bộ nhớ (memory leaks) khi deactive extension.



### 2.5 DiagramRenderer.ts

**Responsibility:** Render Server-side SVG cho PlantUML/BPMN.

* **Skin Constraints:** Ép buộc các tham số mặc định: `skinparam linetype ortho`, `skinparam nodesep 60`, `hide empty members` để biểu đồ tối giản, phù hợp không gian Chat UI.



### 2.6 LangGraphOrchestrator (NEW Backend Engine)

**Responsibility:** Quản lý Dynamic Graph Routing, quản trị SQLite Checkpointer, xử lý ngắt luồng (Breakpoint).
**Interfaces:**

```typescript
interface ILangGraphBackend {
  /** Phục hồi toàn bộ lịch sử và context cho IDE vừa kết nối */
  getThreadState(threadId: string): Promise<LangGraphState>;
  /** Tạo session mới và ghi ra .run/session.json */
  createNewThread(): string; 
  /** Đánh thức đồ thị đang bị PAUSED */
  resumeThread(threadId: string, action: 'APPROVE'|'REJECT'|'REGENERATE'): Promise<void>;
}

interface LangGraphState {
  messages: BaseMessage[];
  ide_context: { active_file: string | null; lsp_diagnostics: Diagnostic[] };
  pending_tool_call: ToolCallRequest | null;
}

```

---

## 3. Svelte Component Architecture

### 3.1 Event Flow (Webview Internal & Hydration)

**Khởi tạo (Hydration Flow - Multi-IDE Sync):**

1. User mở IDE (VSCode/AntiGravity), Svelte App chạy `onMount()`.
2. Gửi `REQUEST_SYNC_STATE` lên Extension Host.
3. Host đọc `thread_id` từ `.code-intel/.run/session.json`, gọi `getThreadState()` từ Backend.
4. Host trả về `SYNC_CHAT_HISTORY` (chứa toàn bộ `messages` và `context`).
5. `chatStore` và `contextStore` cập nhật, auto-scroll xuống đáy, UI hiển thị nguyên trạng phiên làm việc.

**Tương tác (Action Flow):**
User types → ChatInput → `SEND_PROMPT` → Backend lưu SQLite → Backend Pub/Sub Stream → Webview nhận `STREAM_TOKEN`.

---

## 4. API Design — Message Type Definitions

### Base Message Types (Frontend ↔ Host)

```typescript
// Direction: Extension Host/Backend → Webview
type ExtensionMessage =
  | { type: 'SYNC_CHAT_HISTORY'; messages: ChatMessage[]; context: ContextState } // [v3.0]
  | { type: 'STREAM_START'; messageId: string; agentId: string }[cite: 6]
  | { type: 'STREAM_TOKEN'; messageId: string; token: string }[cite: 6]
  | { type: 'STREAM_END'; messageId: string }[cite: 6]
  | { type: 'STREAM_ERROR'; messageId: string; error: StreamError }[cite: 6]
  | { type: 'TOOL_CALL_REQUEST'; toolId: string; name: string; args: Record<string, unknown>; requiresApproval: boolean; toolType: ToolType }[cite: 6]
  | { type: 'CONTEXT_UPDATE'; tokenCount: number; maxTokens: number; files: ContextFile[] };[cite: 6]

// Direction: Webview → Extension Host/Backend
type WebviewMessage =
  | { type: 'REQUEST_SYNC_STATE' } // [v3.0]
  | { type: 'SEND_PROMPT'; text: string; agentId: string; contextFiles?: string[] }[cite: 6]
  | { type: 'TOOL_CALL_RESPONSE'; toolId: string; decision: 'APPROVE' | 'REJECT' }[cite: 6]
  | { type: 'ACTION_ACCEPT_DIFF'; diffId: string; filePath: string; patch: string }[cite: 6]
  | { type: 'REGENERATE_PATCH'; diffId: string; filePath: string }[cite: 6]
  | { type: 'CONTEXT_CLEAR' };[cite: 6]

```

---

## 5. Error Handling & Concurrent Modification

### File Conflict Resolution (Đồng bộ với Checkpointer)

1. User clicks "Accept" trên ActionableDiff.


2. Compute SHA-256 hash của file hiện hành.


3. Nếu **Khớp**: Apply WorkspaceEdit → Gửi lệnh `Resume(Success)` tới Checkpointer.
4. Nếu **Mismatch (Dirty)**: UI Block → Hiện cảnh báo → Nút "Regenerate Patch".


5. User clicks "Regenerate" → Gửi lệnh `Resume(Error: Conflict)` tới Checkpointer. Đồ thị LangGraph tự động đọc lại file và re-generate mã.



---

## 6. Implementation Checklist (DEV Agent Roadmap)

### Phase 0: Backend Agentic Refactoring (Days 1-3)

| # | Task | Module |
| --- | --- | --- |
| 0.1 | Thiết kế `LangGraphState` schema (IDE Context & Tool Control) | `LangGraphOrchestrator` |
| 0.2 | Xây dựng Dynamic Graph Routing load cấu hình từ `.code-intel/agents` | `LangGraphOrchestrator` |
| 0.3 | Cấu hình SQLite Checkpointer tại `database/chat_history.db` | `LangGraphOrchestrator` |
| 0.4 | Triển khai hàm `interrupt()` cho các Tool Nodes (Dangerous Tools) | `LangGraphOrchestrator` |
| 0.5 | Xây dựng Hydration API `getThreadState` cho Multi-IDE | `LangGraphOrchestrator` |

### Phase 1: Foundation (Days 4-5)

| # | Task | Module |
| --- | --- | --- |
| 1.1 | Setup Vite + Svelte 4 project structure

 | Build

 |
| 1.3 | Implement MessageRouter với Token Buffering 16-50ms | `MessageRouter.ts` |
| 1.5 | Create Svelte stores (Mirror Data)

 | `stores/`<br> |

### Phase 2: Multi-IDE IPC & Context (Days 6-8)

| # | Task | Module |
| --- | --- | --- |
| 2.1 | Đọc `session.json` và gọi API Hydration khi Svelte Mount | `App.svelte` / `IpcBridge.ts` |
| 2.2 | Thiết lập Pub/Sub Broadcasting qua WebSocket | `IpcBridge.ts` |
| 2.3 | Lifecycle hooks: Gắn `IpcBridge.dispose()` vào Extension Context | `extension.ts` |

*(Các Phase tiếp theo từ Phase 3 đến Phase 9 như xây dựng ActionableDiff, PermissionGuard, TerminalLogBlock, DiagramRenderer... được giữ nguyên và tích hợp tương ứng).*

---

## 7. Data Flow Diagrams

### 7.1 Backend-Driven Chat Flow (Multi-IDE)

```text
// Luồng Gửi tin nhắn
IDE Client (VSCode/AG) → SEND_PROMPT → Extension Host → LangGraph Backend
                                                             ↓
                                              Lưu vào SQLite Checkpointer (thread_id)
                                                             ↓
// Luồng Nhận & Đồng bộ (Pub/Sub)
LangGraph Backend → Phân phối STREAM_TOKEN / SYNC_CHAT_HISTORY 
                  → IpcBridge (Broadcasting) 
                  → Tất cả IDE Clients (VSCode, Kiro, Antigravity) đang mở

```