# FSD - SA4E-189

## 1. Overview
Functional Specification for Extension Hot-Reload Agentics UI

## 2. Use Cases
- UC1: Agent markdown file created/modified/deleted in `.code-intel/agents/*.md` → agent list UI updates after 300ms debounce
- UC2: Steering file created/modified/deleted in `.code-intel/steering/*.md` → steering list UI updates after 300ms debounce
- UC3: Hooks file created/modified/deleted in `.code-intel/hooks/*.md` → log reload, ready for future UI
- UC4: Skills file created/modified/deleted in `.code-intel/skills/*.md` → log reload, ready for future UI
- UC5: Multiple rapid changes → only last change triggers update per watcher
- UC6: Workspace without folder → watcher no-op, no error

## 3. API Contracts
- `vscode.FileSystemWatcher.onDidCreate/onDidChange/onDidDelete` → trigger debounce per folder
- `ChatStateManager.sendAgentsInfo()` → pushes updated agent list to webview
- `ChatStateManager.sendSteeringInfo()` → pushes updated steering list to webview
- `ChatStateManager.dispose()` → disposes all watchers and timers

*Updated for .code-intel agentics hot-reload*

