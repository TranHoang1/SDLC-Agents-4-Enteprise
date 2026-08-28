---
paths:
  - "**/*.html"
  - "**/*.tsx"
  - "**/*.svelte"
---

# Manual Web Test — Mandatory Procedure

## When to apply

When user requests "test manual", "QA test", "test web", "test UI", or any browser UI testing.

## Procedure

### Step 1: DevOps — Build & Start Server

1. **Detect build system** — package.json → npm, pyproject.toml → Python, Makefile → make, etc.
2. **Run build** — verify exit code 0
3. **Start server** — use background process, verify ready within 30s
4. **Verify accessible** — navigate to URL, confirm page loads

### Step 2: QA — Test all screens

Use browser DevTools MCP tools (`navigate_page`, `take_snapshot`, `take_screenshot`, `click`, `fill`):

1. Open each page, verify no 404/blank/Loading stuck/JSON error
2. Test flows: Login → Profile → Logout, CRUD, error states
3. Discover ALL pages from source code routes + nav-bar
4. Record results: `[ ] /<path> — description — status`

### Step 3: Dev — Fix bugs

If QA finds bugs → Dev fixes immediately → DevOps rebuild + restart → QA retest

### Step 4: Loop until PASS

Loop: Fix → Build → Deploy → Test until ALL pages PASS

### Step 5: Report

Only report when ALL tests pass:

```
## ✅ Manual Web Test — PASSED

| Page | Status | Notes |
|------|--------|-------|
| /login | ✅ | ... |

Server running at: localhost:{port}
```

## ⛔ NEVER

- Report "restart server to test" — DevOps must restart
- Report each bug one by one — fix all then report
- Skip any page — test ALL
- Leave "Loading..." or JSON parse errors — debug console

## Tools

- `mcp_lowcode_devtools_local_navigate_page`, `take_snapshot`, `take_screenshot`, `click`, `fill`
- `control_pwsh_process` — start/stop server
- `execute_pwsh` — build commands