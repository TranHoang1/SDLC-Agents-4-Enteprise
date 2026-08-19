---
inclusion: fileMatch
fileMatchPattern: "extension/src/webview/**"
---

# Frontend Architecture — Svelte 4 + Vite + TypeScript

## Tech Stack

- **Svelte 4** — Component-based UI framework
- **Vite** — Bundler + dev server (`@sveltejs/vite-plugin-svelte`)
- **TypeScript** — Frontend logic (`extension/src/webview/`)
- **svelte-check** — Type checking + linting

## Core Rules (chi tiết xem #[[file:documents/frontend-rules-detail.md]])

### 1. TÁCH BIỆT MARKUP VÀ LOGIC
- **LUÔN** dùng Svelte component files (`.svelte`) cho UI structure
- **KHÔNG** tạo HTML string trong TypeScript code (no innerHTML with HTML)
- Svelte logic trong `<script lang="ts">`, markup trong `<template>`, styles trong `<style>`
- Dynamic repeated elements dùng Svelte `{#each}` blocks

### 2. VIEW / CONTROLLER Pattern
| Layer | Nơi đặt | Chứa gì |
|-------|---------|---------|
| **VIEW** | `*.svelte` files | HTML structure, CSS, bindings |
| **CONTROLLER** | `*.ts` files (stores, lib) | State management, API calls, event handling |

### 3. SVELTE STORE CHO STATE
- Global state dùng Svelte stores (writable/derived)
- Mỗi feature domain 1 store riêng (session, tickets, kb, etc.)
- KHÔNG dùng mutable global variables

### 4. UX BẮT BUỘC
- Mọi thao tác PHẢI có feedback: Loading spinner, Empty state + action, Error message + fix action, Success confirmation
- KHÔNG BAO GIỜ fail silently — mọi catch block phải hiển thị lỗi cho user
- Mọi API call PHẢI handle 3 trạng thái: loading, success, error

### 5. BLOCKING OVERLAY
- Mọi async operation (SAVE, TEST, DELETE, START, STOP, SCAN...) PHẢI có loading state
- Hiển thị loading TRƯỚC khi await, tắt trong `finally`
- Message mô tả cụ thể: "Saving...", "Testing connection...", KHÔNG dùng "Please wait"

### 6. BROWSER MEMORY MANAGEMENT
- Dữ liệu tích lũy (logs, lists) dùng `sessionStorage` cho dedup IDs, cap DOM nodes
- Reset khi bắt đầu operation mới

### 7. DARK THEME
- Dùng CSS variables cho theming (`--primary`, background colors)
- Native form elements PHẢI styled đồng bộ với theme

## API & Routing
- `@vscode/webview-ui-toolkit` hoặc native webview API cho VS Code integration
- API calls qua `vscode.postMessage()` / `acquireVsCodeApi()`
- Hash-based routing nếu multi-view: `#dashboard`, `#analysis`, etc.

## Build Commands
- Dev: `npm run dev` (vite dev server) trong `extension/src/webview/`
- Build: `npm run build` (vite build + svelte-check)
