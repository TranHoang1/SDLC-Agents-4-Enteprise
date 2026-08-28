# DISCREPANCY — SA4E-102: Jira Project → Knowledge Base

**Date:** 2026-08-28
**Reviewer:** Code review (manual)
**Scope:** Gap between BRD/FSD requirements and actual implementation in `extension/` + `backend/`

## 1. Summary

| Area | Status |
|------|--------|
| Batch sync — Option A (deep crawl + ingest) | ✅ Implemented in extension |
| On-demand cache — auto-ingest on `jira_get_issue` | ❌ Not implemented (BRD MUST HAVE) |
| Graph integration — TICKET nodes + edges | ❌ Not implemented (BRD SHOULD HAVE) |
| Backend `jira_index_project` MCP tool (FSD design) | ⚠️ Replaced by direct REST call (functional equivalent) |

**Conclusion:** Option A (batch sync) is complete. Option C (on-demand cache) and Graph integration are missing.

## 2. Implemented — verified against code

- `extension/src/indexer.ts:137` — Quick Pick menu shows **"Index Jira Project"** option.
- `extension/src/services/JiraProjectIndexer.ts` — orchestrator: prompts project key, paginated JQL fetch (`PAGE_SIZE=50`), deep crawl via `LinkCrawler` (depth ≤ 2, `visitedKeys` anti-loop), attachment download+convert, ingest via `POST /api/v1/memory/ingest`.
- `extension/src/services/jira-sync/` — `LinkCrawler`, `KbEntryBuilder` (3 entries/ticket: metadata/comments/links), `CommentSummarizer`, `AdfConverter`, `AttachmentFetcher`, `SyncState` (incremental sync).
- KB entries use `source: jira/{PROJECT}/{KEY}/{type}`, `scope=PROJECT` → `mem_search` finds them without calling Jira API (satisfies AC-2 intent).
- The 14 ACs listed in `JIRA-UPDATE.md` are effectively satisfied by the extension code, **even though the doc marks all 14 as `[ ]` unchecked**.

## 3. Missing vs BRD / FSD

| ID | Requirement | Source | Priority | Status | Evidence |
|----|-------------|--------|----------|--------|----------|
| D-1 | On-demand auto-cache: `jira_get_issue` must auto-ingest fetched ticket into KB (fire-and-forget, <500ms) | BRD #2 (MUST HAVE); FSD UC-02 | MUST | ❌ | `backend/src/servers/atlassian/tools/jira-issue-tools.ts:18-19` returns `res.data` only — no ingest hook |
| D-2 | Graph node per ticket: `mem_graph(action:"add_node")` `type=TICKET`, `label="{KEY}: {summary}"` | BRD #4 (SHOULD HAVE); FSD UC-04 | SHOULD | ❌ | No `mem_graph` / `add_node` call anywhere in `jira-sync/` or `JiraProjectIndexer.ts` |
| D-3 | Graph edges `DEPENDS_ON` / `IMPLEMENTS` / `RELATES_TO` between linked tickets | BRD #4; FSD UC-05 | SHOULD | ❌ | Links stored only as text in links entry (`KbEntryBuilder.ts:100-104`); no `add_edge` |
| D-4 | Backend MCP tool `jira_index_project` (FSD design) | FSD §3 | Design deviation | ⚠️ | Extension calls `POST /api/v1/memory/ingest` directly instead of an MCP tool (functionally equivalent) |

## 4. Minor deviation

- **D-5:** Linked-issue KB entry `type: CONTEXT` (`KbEntryBuilder.ts:124`); original ticket expected `ARCHITECTURE`. Low impact, no functional break.

## 5. Stale / misleading artifacts

- **`JIRA-UPDATE.md`** — all 14 ACs marked `[ ]` (unchecked) but actually implemented in the extension. The doc only covers Option A and omits on-demand cache + graph, so it does not reflect the true original scope (BRD/FSD).
- **`STATUS.json`** — all phases `not_started`, `currentPhase: requirements`; contradicts reality (implementation In Progress in Jira). Needs refresh.

## 6. Recommendation

1. Route **D-1** (MUST) and **D-2/D-3** (SHOULD) to **dev-agent** for Phase 5 implementation:
   - Add auto-ingest hook in `jira_get_issue` (call KBClient.ingest after fetch, async/non-blocking).
   - Add `mem_graph` `add_node` (type=TICKET) + `add_edge` (DEPENDS_ON/IMPLEMENTS/RELATES_TO) in `JiraProjectIndexer` / `KbEntryBuilder`.
2. SM to refresh `STATUS.json` and either update `JIRA-UPDATE.md` or supersede it with this discrepancy record.
