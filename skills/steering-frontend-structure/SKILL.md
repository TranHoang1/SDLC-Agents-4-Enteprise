---
name: steering-frontend-structure
description: Frontend structure rules for extension/** Svelte 4 + Vite files.
---

# Frontend Architecture — Svelte 4 + TypeScript

## Tech Stack

- **Svelte 4** — Frontend UI framework, compile sang JS bundle
- **TypeScript** — Frontend logic, compile sang JavaScript
- **Svelte Components** — Tách biệt khỏi logic, `src/lib/components/`
- **CSS Files** — Obsidian Kinetic design system, `src/lib/styles/`
- **Vite** — Bundler + dev server, `server.fs`, `build.outDir`
- **Shared TypeScript module** — Shared data models, DTOs (zod schemas)

## Core Rules (chi tiết xem #[[file:documents/frontend-rules-detail.md]])

### 1. TÁCH BIỆT UI VÀ LOGIC
- **KHÔNG BAO GIỜ** tạo DOM manipulation / innerHTML string trong logic code (no `document.getElementById().innerHTML`)
- **LUÔN** dùng Svelte components (`*.svelte`) — HTML + CSS trong template block
- Logic trong `<script lang="ts">` block hoặc tách vào `lib/`
- Dynamic repeated elements dùng `{#each}` block của Svelte

### 2. COMPONENT / STORE Pattern
| Layer | Nơi đặt | Chứa gì |
|-------|---------|---------|
| **VIEW** | `src/lib/components/*.svelte` + `src/lib/styles/*.css` | HTML structure, CSS classes, bindings |
| **LOGIC** | `src/lib/pages/*.svelte` + `src/lib/stores/*.ts` | Event handlers, API calls, state management |

### 3. KHÔNG TẠO FILE LEGACY
- Không tạo thư mục con HTML/CSS/JS riêng trong `webview/` (e.g., `webview/dashboard/index.html`)
- Root `extension/webview/` chỉ chứa: `package.json`, `vite.config.js`, `index.html`, `src/`, `dist/`

### 4. UX BẮT BUỘC
- Mọi thao tác PHẢI có feedback: Loading spinner, Empty state + action, Error message + fix action, Success confirmation
- KHÔNG BAO GIỜ fail silently — mọi catch block phải hiển thị lỗi cho user
- Mọi API call PHẢI handle 3 trạng thái: loading, success, error

### 5. BLOCKING OVERLAY
- Mọi async operation (SAVE, TEST, DELETE, START, STOP, SCAN...) PHẢI dùng `BlockingOverlay`
- `BlockingOverlay.show()` TRƯỚC `await`, `BlockingOverlay.remove()` trong `finally`
- Message mô tả cụ thể: "Saving...", "Testing connection...", KHÔNG dùng "Please wait"

### 6. BROWSER MEMORY MANAGEMENT
- Dữ liệu tích lũy (logs, lists) dùng `sessionStorage` cho dedup IDs, cap DOM nodes (max 500 logs, 200 chat)
- Reset khi bắt đầu operation mới

### 7. NATIVE FORM ELEMENTS ON DARK THEME
- `<select>` PHẢI có `background: rgba(12,14,22,0.95)` + `color: var(--primary)`
- `<input>` LUÔN dùng class `.field-input`
- `-webkit-appearance: none; appearance: none;` cho custom styling

## API & Routing
- `fetch` / `undici`, JWT trong `sessionStorage`
- Hash-based routing: `#dashboard`, `#analysis`, etc.
- API calls qua Svelte stores (`writable`) — `apiClient.loadTemplate(name)` — fetch `/templates/$name.html`

## Build Commands
- Dev: `npm run dev` (Vite dev server)
- Build: `npm run build` (Vite production build)
