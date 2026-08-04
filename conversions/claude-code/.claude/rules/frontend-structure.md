---
paths: "extension/src/webview/**"
---

# Frontend Architecture — Svelte 4 + Vite + TypeScript

## Tech Stack
- **Svelte 4** — Webview UI components
- **Vite** — Bundler + dev server
- **TypeScript** — Strong typing, logic separated from DOM
- **CSS Files** — Obsidian Kinetic design system, `resources/styles/`

## Core Rules

### 1. SEPARATE MARKUP AND LOGIC
- **NEVER** create HTML strings in code (no innerHTML with HTML, no template-literal HTML)
- **ALWAYS** use Svelte component files + logic in `<script>` block or `.ts` modules
- DOM manipulation only via Svelte bindings and actions

### 2. VIEW / CONTROLLER Pattern
| Layer | Location | Contains |
|-------|----------|----------|
| VIEW | `extension/src/webview/**/*.svelte` + `resources/styles/*.css` | HTML structure, CSS classes |
| CONTROLLER | `extension/src/webview/**/*.ts` (stores, actions) | Event binding, API calls, state |

### 3. UX MANDATORY
- Every action MUST have feedback: Loading spinner, Empty state, Error message, Success
- NEVER fail silently — every catch block must display error
- Every API call MUST handle: loading, success, error

### 4. BLOCKING OVERLAY
- Every async operation MUST use `BlockingOverlay` component
- Show BEFORE await, remove in `finally`

### 5. NATIVE FORM ELEMENTS ON DARK THEME
- `<select>`: `background: rgba(12,14,22,0.95)` + `color: var(--primary)`
- `<input>`: class `.field-input`
- `-webkit-appearance: none; appearance: none;`

## Build
- Dev: `npm run esbuild-watch` or `npm run watch`
- Build: `npm run esbuild` / `npm run esbuild-production`
