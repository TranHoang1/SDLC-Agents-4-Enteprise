# RUN-LOG — SA4E-82

## Ticket
- **Key:** SA4E-82
- **Title:** [Pega MCP] Register 8 Pega tools as hidden local tools (find_tools/execute_dynamic_tool)
- **Project:** SA4E (SDLC Agents 4 Enterprise)
- **Status:** Done
- **Parent:** SA4E-56 (Pega KB AST Semantic Engine & Dynamic MCP Tools Integration)

## Objective
Wire the extension's implemented Pega MCP tools into the MCP layer so they become discoverable via `find_tools` and callable via `execute_dynamic_tool`, while staying hidden from the default `tools/list`.

## Timeline

| Phase | Agent | Date | Result |
|-------|-------|------|--------|
| Implementation | DEV | 2026-07-31 | Wired 8 Pega tools as hidden local tools |
| Testing | QA | 2026-07-31 | 589/589 tests; live MCP verification on :9181 |
| Jira | SM | 2026-07-31 | SA4E-82 created -> To Do -> Done (transition id 41, comment added) |
| Docs (backfill) | BA/TA/SA/QA/DevOps | 2026-07-31 | BRD, FSD, TDD, STP, STC, DPG, RLN + STATUS.json |

## Changes
- `extension/src/backend-local-tools.ts`: dynamic registry — `registerLocalTool`, `isLocalTool`, `executeLocalTool`, `getLocalToolDefinitions`, `getVisibleLocalToolDefinitions`, `LocalToolDefinition.hidden?: boolean`.
- `extension/src/mcp/pega-local-tools.ts` (new): `registerPegaLocalTools` + `getPegaLocalToolDefinitions` for the 8 tools.
- `extension/src/services/WrapperServer.ts`: `isLocalTool`-first routing, `rewriteFindToolsResponse` merges local defs, `handleDynamic` routes pega_* locally.
- `extension/src/remote-backend-client.ts`: `restGetTools` uses visible-only defs; optional `vscode.SecretStorage` param.
- `extension/src/extension.ts`: passes `context.secrets` into `McpServerManager`.
- Tests: `pega-local-tools.test.ts` (new), `wrapper-server.test.ts` (TC-37/38/25).

## Verification
- `tools/list` (port 9181): 20 -> 12 after hiding.
- `find_tools("pega create branch")`: 8 pega + existing tools (60 total).
- `execute_dynamic_tool(pega_get_session_context)`: operator `SSA@TGB`, app `HRAppsV2`.
- `pega_list_rules`: live Pega rules returned.
- Extension tests: 589 passed / 40 files; compile clean; esbuild OK.
- VSIX repackaged: `extension/sdlc-agents-4-enterprise-1.19.1.vsix` (979 files, 5.03 MB).

## Artifacts
- `documents/SA4E-82/BRD.md`, `FSD.md`, `TDD.md`, `STP.md`, `STC.md`, `DPG.md`, `RLN.md`, `TEST-REPORT-SA4E-82.csv`, `STATUS.json`
- `documents/SA4E-82/DPG-v1-SA4E-82.docx`, `documents/SA4E-82/RLN-v1-SA4E-82.docx`
- `documents/SA4E-82/diagrams/` (draw.io + PNG), `documents/SA4E-82/testdata/`, `documents/SA4E-82/evidence/`

## Notes / Known Issues
- Jira transition comment not saved by transition API; comment added separately via `jira_add_comment` (`body` field).
- Pre-existing lint issue: `extension/eslint.config.js` imports `typescript-eslint`, missing from devDependencies.
- code-intel MCP backend unreachable during doc generation — KB ingest logged as warning only, not blocking.
