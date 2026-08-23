# User Guide Verification Report — SA4E-193

**Date:** 2026-08-23
**Verifier:** QA Agent
**UG Version:** 1.0
**Environment:** Windows, Node.js 18+, Backend v1.33.0

---

## Summary

| Step | Description | Status | Notes |
|------|-------------|--------|-------|
| 1 | Quick Start (§2.1) — Server startup | ✅ PASS | Server starts, logs match expected output |
| 2 | Minimal Config (§3.4) — JSON syntax | ✅ PASS | Valid JSON, settings exist in extension |
| 3 | Full Config (§3.4) — JSON syntax | ✅ PASS | Valid JSON, all settings defined |
| 4 | Tools/List Request | ⚠️ PARTIAL | Endpoint exists, requires auth (not documented in UG) |
| 5 | Tool Calls | ⚠️ PARTIAL | Cannot test without auth token |
| 6 | Error Codes (§6.2) | ❌ FAIL | Error codes NOT implemented; messages exist |
| 7 | Config Validation (§6.3) | ✅ PASS | Backend env vars match code |

**Overall:** 4 PASS, 2 PARTIAL, 1 FAIL

---

## Detailed Results

### Step 1: Quick Start (§2.1) — ✅ PASS

**Action:** Ran `npm run dev` in the project root.

**Expected (UG §2.1):**
- Server starts on port 48721
- Modules initialize (memory, codeIntel, orchestration, analytics, kbGraph, utility, knowledge, security)

**Actual:**
```json
{"level":30,"msg":"Starting Backend MCP Server","config":{"port":48721,"host":"0.0.0.0"}}
{"level":30,"msg":"[admin] DB adapter connected and ready","engine":"postgresql"}
{"level":30,"msg":"Module registered","module":"memory"}
{"level":30,"msg":"Module registered","module":"codeIntel"}
{"level":30,"msg":"Module registered","module":"orchestration"}
{"level":30,"msg":"Module registered","module":"analytics"}
{"level":30,"msg":"Module registered","module":"kbGraph"}
{"level":30,"msg":"Module registered","module":"utility"}
{"level":30,"msg":"Module registered","module":"knowledge"}
{"level":30,"msg":"Module registered","module":"security"}
{"level":30,"msg":"Module initialized","module":"memory","status":"ready"}
{"level":30,"msg":"Module initialized","module":"codeIntel","status":"ready"}
{"level":30,"msg":"Module initialized","module":"orchestration","status":"ready"}
{"level":30,"msg":"Module initialized","module":"analytics","status":"ready"}
{"level":30,"msg":"Module initialized","module":"kbGraph","status":"ready"}
{"level":30,"msg":"Module initialized","module":"utility","status":"ready"}
{"level":30,"msg":"Module initialized","module":"knowledge","status":"ready"}
{"level":30,"msg":"Module initialized","module":"security","status":"ready"}
```

**Health endpoint:** `GET /health` returns `{"status":"healthy","version":"1.0.0","tools_loaded":88,"modules":{...}}`

**Verdict:** ✅ Server starts correctly, all 8 modules initialize, logs match expected behavior.

---

### Step 2: Minimal Config (§3.4) — ✅ PASS

**UG Example:**
```json
{
  "kiroSdlc.backend.url": "http://127.0.0.1:48721"
}
```

**Verification:**
- ✅ JSON syntax is valid
- ✅ Setting `kiroSdlc.backend.url` is defined in `extension/package.json` contributes.configuration

**Verdict:** ✅ Config is syntactically valid and setting exists in extension schema.

---

### Step 3: Full Config (§3.4) — ✅ PASS

**UG Example:**
```json
{
  "kiroSdlc.backend.url": "http://127.0.0.1:48721",
  "kiroSdlc.mcpServerPort": 9181,
  "kiroSdlc.enableMcpServer": true,
  "kiroSdlc.llmProvider": "anthropic",
  "kiroSdlc.llmModel": "claude-sonnet-4-20250514",
  "kiroSdlc.configPath": ".code-intel/orchestration.json",
  "kiroSdlc.backend.toolCallTimeout": 300000,
  "kiroSdlc.backend.chatTimeout": 120000,
  "kiroSdlc.backend.healthCheckInterval": 30000
}
```

**Verification:**
- ✅ JSON syntax is valid
- ✅ All 9 settings verified in `extension/package.json`:
  - `kiroSdlc.backend.url` ✅
  - `kiroSdlc.mcpServerPort` ✅
  - `kiroSdlc.enableMcpServer` ✅
  - `kiroSdlc.llmProvider` ✅
  - `kiroSdlc.llmModel` ✅
  - `kiroSdlc.configPath` ✅
  - `kiroSdlc.backend.toolCallTimeout` ✅
  - `kiroSdlc.backend.chatTimeout` ✅
  - `kiroSdlc.backend.healthCheckInterval` ✅

**Verdict:** ✅ Config is syntactically valid, all settings exist in extension schema.

---

### Step 4: Tools/List Request — ⚠️ PARTIAL

**Action:** `GET /mcp/tools/list`

**Expected (UG §7):** Returns list of available MCP tools.

**Actual:**
- Without auth: `401 {"error":{"code":"UNAUTHORIZED","message":"Authentication required"}}`
- Health endpoint works without auth: `GET /health` → `200 {"status":"healthy","tools_loaded":88}`

**Issue:** The UG does NOT document that `/mcp/tools/list` requires authentication (API key or session token). The endpoint exists and works correctly, but the UG omits the auth requirement.

**From integration tests:** When authenticated with `X-API-Key: test-api-key-01`, the endpoint returns 88 tools including:
- Memory tools: `mem_search`, `mem_ingest`, `mem_delete`
- Orchestration tools: `find_tools`, `execute_dynamic_tool`, `orchestration_status`
- Utility tools: `agent_log`
- Code intelligence tools: `code_search`, `stream_write_file`

**Verdict:** ⚠️ Endpoint works but UG is missing authentication documentation for `/mcp/tools/list`.

---

### Step 5: Tool Calls — ⚠️ PARTIAL

**Action:** `POST /mcp/tools/call`

**Expected (UG §7):** Execute an MCP tool by name.

**Actual:** Cannot test without authentication. From integration test code, the endpoint works correctly:
- Returns `400` for missing `tool_name`
- Returns `404` for unknown tool
- Returns tool result for valid calls

**Verdict:** ⚠️ Endpoint exists and is functional per integration tests, but cannot be manually verified without auth.

---

### Step 6: Error Codes (§6.2) — ❌ FAIL

**UG Documents:**

| Code | Message | Actual Code |
|------|---------|-------------|
| `ERR_DESC_REQUIRED` | "Description is required" | ❌ NOT in code |
| `ERR_NAME_INVALID` | "Name must be kebab-case" | ❌ NOT in code |
| `ERR_LLM_FAILED` | "LLM generation failed, falling back to template" | ❌ NOT in code |
| `ERR_FILE_WRITE` | "Failed to create {type}: {message}" | ❌ NOT in code |

**Actual Implementation (ConfigCommands.ts):**

The code uses `vscode.window.showInputBox` validation callbacks that return message strings directly, NOT error codes:

```typescript
// Line 287-291
validateInput: (value) => {
  if (!value || value.trim().length === 0) {
    return "Description is required";  // Message string, not error code
  }
  return null;
}
```

```typescript
// Line 303-307
validateInput: (value) => {
  if (!value || !/^[a-z][a-z0-9-]*$/.test(value)) {
    return "Name must be kebab-case (e.g., my-agent)";  // Message string, not error code
  }
  return null;
}
```

```typescript
// Line 325
vscode.window.showErrorMessage(`Failed to create agent: ${(err as Error).message}`);
```

**Issues Found:**
1. ❌ Error codes `ERR_DESC_REQUIRED`, `ERR_NAME_INVALID`, `ERR_LLM_FAILED`, `ERR_FILE_WRITE` do NOT exist in the codebase
2. ❌ The code uses message strings directly, not error code constants
3. ❌ `ERR_LLM_FAILED` message is only logged to `console.debug`, not shown to user
4. ❌ `ERR_FILE_WRITE` message format differs: UG says "Failed to create {type}: {message}", code says "Failed to create agent: {message}"

**Verdict:** ❌ UG documents error codes that do not exist in the implementation. The actual code uses inline message strings.

---

### Step 7: Config Validation (§6.3) — ✅ PASS

**Backend Environment Variables (UG §3.2):**

| Variable | UG Default | Code Default | Match |
|----------|-----------|-------------|-------|
| `CODE_INTEL_PORT` | `48721` | `48721` | ✅ |
| `CODE_INTEL_HOST` | `0.0.0.0` | `0.0.0.0` | ✅ |
| `CODE_INTEL_DATA_DIR` | `.code-intel` | `.code-intel` | ✅ |
| `CODE_INTEL_DB` | `index.db` | `index.db` | ✅ |
| `CODE_INTEL_ONNX_MODEL` | `models/model.onnx` | `models/model.onnx` | ✅ |
| `CODE_INTEL_ORCHESTRATION` | `orchestration.json` | `orchestration.json` | ✅ |
| `CODE_INTEL_LOG_LEVEL` | `info` | `info` | ✅ |

**Zod Validation Rules (BackendConfig.ts):**
- ✅ Port: `z.number().min(1024).max(65535)` — validated
- ✅ LogLevel: `z.enum(['debug', 'info', 'warn', 'error'])` — validated

**Verdict:** ✅ All backend env var defaults and validation rules match the code.

---

## Additional Findings

### Slash Commands Registration
- ✅ All 4 commands registered in `ConfigCommands.ts`:
  - `create-new-agent` ✅
  - `create-new-hook` ✅
  - `create-new-steering` ✅
  - `create-new-skill` ✅
- ✅ All 4 commands in slash menu (`SlashMenuItems.ts`)

### Output File Locations
- ✅ Agent: `.code-intel/agents/{name}.md`
- ✅ Hook: `.code-intel/hooks/{name}.json`
- ✅ Steering: `.code-intel/steering/{name}.md`
- ✅ Skill: `.code-intel/skills/{name}/SKILL.md`

### Template Formats
- ✅ Agent: YAML frontmatter with `name`, `label`, `description`, `phase`, `tools`
- ✅ Hook: JSON with `enabled`, `name`, `description`, `version`, `when`, `then`
- ✅ Steering: YAML frontmatter with `inclusion`, `description`
- ✅ Skill: YAML frontmatter with `name`, `description`

### Name Validation
- ✅ Kebab-case pattern `^[a-z][a-z0-9-]*$` matches UG documentation

### LLM Integration
- ✅ Extension uses `vscode.lm.selectChatModels` for Copilot integration
- ✅ Fallback to template-based generation when LLM unavailable

---

## Defects to Report

| # | Severity | Description | UG Section | Actual Behavior |
|---|----------|-------------|------------|-----------------|
| 1 | Major | Error codes `ERR_DESC_REQUIRED`, `ERR_NAME_INVALID`, `ERR_LLM_FAILED`, `ERR_FILE_WRITE` do not exist in code | §6.2 | Code uses inline message strings |
| 2 | Minor | UG omits auth requirement for `/mcp/tools/list` | §7.1 | Endpoint requires API key or session token |
| 3 | Minor | `ERR_LLM_FAILED` message only logged to console, not shown to user | §6.2 | `console.debug("[ConfigCommands] LLM generation failed...")` |

---

## Recommendations

1. **Update UG §6.2**: Remove error code constants (`ERR_*`) or document that they are conceptual identifiers, not actual code constants
2. **Update UG §7**: Add authentication documentation for `/mcp/tools/list` and `/mcp/tools/call` endpoints
3. **Consider implementing error codes**: If error codes are desired for API consumers, implement them as constants in the extension code

---

**Report Generated:** 2026-08-23
**Verified By:** QA Agent (automated code analysis + manual server testing)
