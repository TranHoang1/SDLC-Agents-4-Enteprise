# User Guide - SA4E-189

## Hot-Reload System — Extension Agentics

### Overview
The Hot-Reload System enables agentics UI updates without reloading Kiro. When markdown files in `.code-intel/agents/`, `.code-intel/steering/`, `.code-intel/hooks/`, `.code-intel/skills/` are created, modified, or deleted, the extension automatically refreshes the corresponding UI in the chat panel.

### Prerequisites
- Kiro IDE with SDLC Agents 4 Enterprise extension installed v1.33.0+
- Workspace with `.code-intel/` directory
- Extension enabled

### How It Works

1. **File Watcher**: Extension monitors `workspaceRoot/.code-intel/agents/*.md`, `steering/*.md`, `hooks/*.md`, `skills/*.md`.
2. **Debounce**: Changes are debounced for 300ms to prevent rapid UI updates during editing.
3. **Refresh**: On debounce expiry, `ChatStateManager` calls `sendAgentsInfo()`, `sendSteeringInfo()` etc., pushing updated lists to webview.
4. **Dispose**: Watchers disposed when chat panel closed.

### Running the System

- Install extension:
  ```bash
  kiro --install-extension extension/sdlc-agents-4-enterprise-1.33.0.vsix
  ```
- Reload Kiro window to activate.
- Open Chat Panel → agentics lists update automatically on file changes.

### Triggers

| Action | Result |
|--------|--------|
| Create/modify/delete agent .md | Agent list updates after ~300ms |
| Create/modify/delete steering .md | Steering list updates after ~300ms |
| Create/modify/delete hooks/skills .md | Watcher logs reload, ready for UI |
| Rapid file changes | Only last change triggers refresh |
| No `.code-intel` folder | Watcher no-op, no error |

### Security
- Only `.md` files under `.code-intel/` are watched.
- No code execution, runs entirely in extension context.

### Development

```bash
cd extension
npm run esbuild
npm run package:prod
```

### Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| List not updating | Extension not reloaded | Reload Kiro window |
| Watcher not active | No workspace opened | Open workspace with `.code-intel` |
| Old build active | Previous vsix installed | Install new vsix `1.33.0` and reload |