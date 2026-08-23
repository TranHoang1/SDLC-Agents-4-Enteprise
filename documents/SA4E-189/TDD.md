# TDD - SA4E-189

## 1. Architecture
Extension FileSystemWatcher for `.code-intel/agents/*.md`, `.code-intel/steering/*.md`, `.code-intel/hooks/*.md`, `.code-intel/skills/*.md`
Reactive agentics UI update via `sendAgentsInfo()`, `sendSteeringInfo()` to webview

## 2. Implementation Plan
- `ChatStateManager` implements `vscode.Disposable`
- Watchers: `agentWatcher`, `steeringWatcher`, `hooksWatcher`, `skillsWatcher` via `vscode.FileSystemWatcher`
- Each watcher monitors `.code-intel/<folder>/*.md` with debounce 300ms
- On create/change/delete: reset timer → call respective refresh method
- Dispose all watchers and timers on cleanup
- No backend changes

*Updated for .code-intel agentics hot-reload*

