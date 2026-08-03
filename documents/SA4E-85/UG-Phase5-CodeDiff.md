# User Guide — Phase 5: Code Diff (SA4E-85)

## Overview

The Code Diff system provides a unified diff viewer with concurrent modification detection. When the AI agent generates code patches, they appear in the chat panel as actionable diff blocks with Accept, Reject, and Regenerate controls.

## Features

### 5.1 ActionableDiff Component

Displays unified diff output with syntax highlighting:
- **Green lines** (`+`) — added code
- **Red lines** (`-`) — removed code
- **Gray lines** (`@@`) — hunk headers
- **White lines** — unchanged context

The header shows the target file path and a colored status badge (Pending, Applied, Rejected, Stale, Conflict).

### 5.2 SHA-256 File Hash

Every patch records the SHA-256 hash of the target file at generation time. Before applying, the system recomputes the hash to detect changes made between patch generation and acceptance.

### 5.3 Concurrent Modification Detection

When you click **Accept**:
1. Current file hash is computed
2. Compared with hash recorded at generation time
3. If mismatch → status changes to **Conflict** and an alert is shown
4. If file was deleted → error `FILE_DELETED` is reported

### 5.4 WorkspaceEdit Integration

Patches are applied via `vscode.workspace.applyEdit()`, which means:
- Full **Ctrl+Z / Ctrl+Y** undo/redo support
- Changes appear in the editor immediately
- Dirty state is properly tracked

### 5.5 Stale Patch Warning

If a patch is older than **5 minutes**, a yellow warning banner appears:

> ⚠ Patch may be outdated

You can still accept it, but the warning indicates the file context may have changed since the patch was generated.

### 5.6 Regenerate Patch Flow

When a conflict is detected:
1. The **Regenerate** button (orange) appears
2. Clicking it sends a `REGENERATE_PATCH` message to the extension host
3. The AI agent generates a fresh patch based on the current file content
4. A new DiffBlock replaces the conflicted one

## Usage

### Accepting a Diff

Click the green **✓ Accept** button. The patch is applied to your file via WorkspaceEdit. If the file was modified since the patch was generated, you'll see a conflict error instead.

### Rejecting a Diff

Click the red **✗ Reject** button. The diff is marked as rejected and no file changes are made.

### Handling Conflicts

If Accept fails due to concurrent modification:
1. The badge changes to **Conflict** (red)
2. Click **↻ Regenerate** to request a fresh patch
3. Review the new diff and accept or reject

## Configuration

No user configuration is required. The staleness threshold (5 minutes) and hash algorithm (SHA-256) are built-in defaults.

## Error Codes

| Error | Meaning | Resolution |
|-------|---------|------------|
| `CONFLICT` | File changed since patch was generated | Use Regenerate button |
| `FILE_DELETED` | Target file no longer exists | Recreate file or reject diff |
| `EDIT_FAILED` | WorkspaceEdit could not be applied | Check file permissions, retry |

## Accessibility

- All buttons have `aria-label` attributes
- Stale warning uses `role="alert"` with `aria-live="polite"`
- Diff region uses `role="region"` with file path label
- Keyboard-navigable buttons with visible focus indicators (WCAG 2.1 AA)
