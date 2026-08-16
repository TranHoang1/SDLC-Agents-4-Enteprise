# User Guide — Plan Canvas (SA4E-132)

## Overview

The Plan Canvas panel provides a visual display of your SDLC pipeline status. It reads `STATUS.json` files from your workspace and renders a color-coded phase diagram showing the progress of each ticket through the pipeline.

## Opening the Panel

1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Search for **"SDLC Agents: Open Plan Canvas"**
3. Press Enter

The panel opens in a new editor tab.

## Understanding the Display

### Phase Progress Bar

Each pipeline phase is shown as a chip with an emoji icon and name. The border color indicates status:

| Color | Status | Meaning |
|-------|--------|---------|
| 🟢 Green (`#4CAF50`) | Done | Phase completed successfully |
| 🟡 Yellow (`#FFC107`) | In Progress | Phase currently active (pulsing animation) |
| 🔴 Red (`#F44336`) | Blocked | Phase cannot proceed |
| ⚪ Gray (`#9E9E9E`) | Not Started | Phase hasn't begun yet |
| 🟠 Orange (`#FF9800`) | Needs Revision | Phase needs rework |

### Phase Icons

| Phase | Icon | Description |
|-------|------|-------------|
| Requirements | 📋 | BRD creation |
| Specification | 📝 | FSD creation |
| Design | 🏗️ | TDD creation |
| Security Design | 🔒 | Security design review |
| Test Planning | 🧪 | STP/STC creation |
| DevOps Setup | ⚙️ | CI/CD pipeline setup |
| Implementation | 💻 | Code development |
| Security Review | 🛡️ | Security code review |
| Testing | ✅ | QA testing |
| Pentest | 🔍 | Penetration testing |
| Deploy Review | 🚀🔒 | Security deployment review |
| Deployment | 🚀 | Production deployment |

### Detail Table

Below the progress bar, a table shows detailed information:
- **Phase** — Name with icon
- **Status** — Color-coded badge
- **File** — Output artifact (e.g., BRD.md, FSD.md)
- **Updated** — Completion timestamp

## Auto-Refresh

The panel automatically refreshes when any `STATUS.json` file changes in your workspace (within ~1 second). No manual action needed.

You can also click the **↻ Refresh** button in the top-right corner to force a refresh.

## Data Source

The panel scans `documents/*/STATUS.json` in your workspace root. Each STATUS.json represents one ticket's pipeline progress. If no STATUS.json files are found, the panel shows "No pipeline found".

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Panel shows "No pipeline found" | Ensure `documents/{TICKET}/STATUS.json` exists in workspace |
| Panel doesn't auto-refresh | Click Refresh button; verify STATUS.json is in workspace root's `documents/` folder |
| Colors not visible | Ensure VS Code theme supports CSS custom properties |

## Requirements

- VS Code 1.85.0 or later
- SDLC Agents 4 Enterprise extension installed
- At least one `documents/{TICKET}/STATUS.json` file in workspace
