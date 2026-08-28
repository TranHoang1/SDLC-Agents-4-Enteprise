# SA4E-102: Index Jira Project → Knowledge Base (Updated)

## Summary
[Indexing] Deep Sync Jira Project into Knowledge Base — với linked tickets, attachments, comments, ADF conversion

## Description

### Objective
Cho phép user index toàn bộ Jira project vào Knowledge Base thông qua menu "Index Workspace". Quá trình sync không chỉ lấy metadata cơ bản mà crawl deep: linked tickets, attachments (download + convert), comments (summarize), và convert ADF → Markdown.

### Scope

**Phase 1 — Deep Crawl Engine:**
- Paginated JQL fetch tất cả tickets trong project
- Per ticket: fetch full issue (description, status, type, priority, labels, assignee, sprint)
- Extract `issuelinks[]` → crawl linked tickets (full-deep, max depth = 2)
- Extract `subtasks[]` → index as part of parent
- Anti-loop: `Set<visitedKeys>` — never fetch same ticket twice

**Phase 2 — Comment Processing:**
- Fetch all comments per ticket (`GET /issue/{key}/comment`)
- Convert ADF (Atlassian Document Format) → Markdown
- Summarize: `[date] @author: 1-line summary`
- Scan comment body for ticket references (`[A-Z]+-\d+`) → add to link graph

**Phase 3 — Attachment Processing:**
- Metadata collection (filename, size, mimeType) for all attachments
- Download text-based files: `.md`, `.txt`, `.json`, `.csv`, `.yml`, `.yaml`
- Convert binary via ConvertToolResolver: `.docx`, `.xlsx`, `.pdf`
- Skip: images, videos, archives (metadata only)

**Phase 4 — KB Ingestion (3 entries per ticket):**
- Entry 1 (`source: jira/{PROJECT}/{KEY}/metadata`): issue fields + description (ADF→MD)
- Entry 2 (`source: jira/{PROJECT}/{KEY}/comments`): comment summary + extracted refs
- Entry 3 (`source: jira/{PROJECT}/{KEY}/links`): link graph + sub-tasks + attachment list

**Phase 5 — Incremental Sync:**
- First run = full sync (all tickets)
- Subsequent runs = only `updated > lastSyncDate`
- Store `lastSyncDate` in workspace config
- User option to force full re-sync

### Technical Design

**Anti-Loop Strategy:**
```
visitedKeys = Set<string>()

crawl(key, depth=0):
  if key ∈ visitedKeys → SKIP
  if depth > 2 → fetch summary only (shallow)
  visitedKeys.add(key)
  fetch issue full (fields + comments + links)
  for each linked key: crawl(linked, depth + 1)
```

**Linked Tickets Outside Project:**
- Full-deep (description + comments + links) nhưng KHÔNG download attachments
- Max depth = 2 từ primary ticket

**ADF → Markdown Conversion:**
- Convert headings, lists, code blocks, mentions, links, tables
- Jira Server/DC wiki markup → also convert to markdown
- Fallback: `renderedBody` (HTML) → strip tags

**File Architecture:**
```
extension/src/services/jira-sync/
├── AdfConverter.ts        — ADF JSON → Markdown
├── CommentSummarizer.ts   — Summarize comment list
├── AttachmentFetcher.ts   — Download + convert text attachments
├── LinkCrawler.ts         — BFS with visitedSet, depth control
├── KbEntryBuilder.ts      — Assemble 3 KB entries per ticket
└── SyncState.ts           — lastSyncDate + visited tracking
```

### API Calls Per Ticket

| Step | API | Purpose |
|------|-----|---------|
| 1 | POST /rest/api/2/search (JQL) | Paginated list all project tickets |
| 2 | GET /rest/api/2/issue/{key}?expand=renderedFields | Full issue + links + subtasks + attachments |
| 3 | GET /rest/api/2/issue/{key}/comment?expand=renderedBody | All comments |
| 4 | GET /rest/api/2/attachment/content/{id} | Download text-based attachments |

---

## Acceptance Criteria

- [x] **AC-1**: QuickPick "Index Workspace" menu hiển thị option "Index Jira Project" (unchecked by default) — verified in `extension/src/indexer.ts:137`
- [x] **AC-2**: Khi chọn, user được prompt nhập Project Key (InputBox với validation) — verified in `extension/src/services/JiraProjectIndexer.ts`
- [x] **AC-3**: Paginated fetch tất cả tickets trong project (JQL `project = KEY`) — verified (PAGE_SIZE=50) in `JiraProjectIndexer.ts`
- [x] **AC-4**: Per ticket: fetch linked issues (inward + outward) với max depth = 2, anti-loop via visitedSet — verified in `LinkCrawler.ts`
- [x] **AC-5**: Per ticket: fetch all comments, convert ADF → Markdown, output summary format `[date] @author: summary` — verified in `CommentSummarizer.ts` + `AdfConverter.ts`
- [x] **AC-6**: Per ticket: download text-based attachments (.md, .txt, .json, .csv, .yml) — convert .docx/.xlsx/.pdf via ConvertToolResolver — verified in `AttachmentFetcher.ts`
- [x] **AC-7**: Per ticket: ingest 3 KB entries (metadata, comments, links) với scope=PROJECT — verified in `KbEntryBuilder.ts`
- [x] **AC-8**: KB entry `source` field format: `jira/{PROJECT}/{KEY}/{type}` (searchable via mem_search) — verified (source pattern + scope=PROJECT)
- [x] **AC-9**: Incremental sync: chỉ fetch tickets có `updated > lastSyncDate` (trừ lần đầu = full) — verified in `SyncState.ts`
- [x] **AC-10**: Linked tickets ngoài project: full-deep (desc + comments + links) nhưng không download attachment — verified in `JiraProjectIndexer.ts`
- [x] **AC-11**: Progress reporting: status bar + output channel hiển thị tiến trình (fetched X/Y, ingesting...) — verified in `JiraProjectIndexer.ts`
- [x] **AC-12**: Error handling: network errors, rate limits (429) → retry with backoff, partial results reported — verified in `JiraProjectIndexer.ts`
- [x] **AC-13**: Comment body scan phát hiện ticket references → add vào links entry — verified in `KbEntryBuilder.ts`
- [x] **AC-14**: ADF fallback: nếu ADF parse fail → dùng renderedBody HTML → strip tags — verified in `AdfConverter.ts`

> **Note (D-5):** Linked-issue KB entry currently uses `type: CONTEXT` (`KbEntryBuilder.ts:124`) instead of the originally specified `ARCHITECTURE`. This is a known minor deviation being addressed — low impact, no functional break. See `DISCREPANCY.md` §4.

---

## Out-of-scope / Tracked Separately

This document covers **Option A (batch sync)** only — the deep-crawl + KB ingestion flow implemented in the VS Code extension (`extension/src/services/jira-sync/*`, `JiraProjectIndexer.ts`).

The following requirements are **NOT covered by this document** and are tracked separately in `DISCREPANCY.md`. They will be routed to a follow-up ticket / dev-agent for Phase 5 implementation:

| ID | Requirement | Source | Status |
|----|-------------|--------|--------|
| D-1 | On-demand auto-cache: `jira_get_issue` must auto-ingest fetched ticket into KB (fire-and-forget, <500ms) | BRD #2 (MUST HAVE); FSD UC-02 | ❌ Not implemented — tracked in DISCREPANCY.md §3 |
| D-2 | Graph node per ticket: `mem_graph(action:"add_node")` `type=TICKET` | BRD #4 (SHOULD HAVE); FSD UC-04 | ❌ Not implemented — tracked in DISCREPANCY.md §3 |
| D-3 | Graph edges `DEPENDS_ON` / `IMPLEMENTS` / `RELATES_TO` between linked tickets | BRD #4; FSD UC-05 | ❌ Not implemented — tracked in DISCREPANCY.md §3 |

> These items remain open gaps vs the full BRD/FSD scope and are intentionally excluded from this doc's acceptance criteria.

## Labels
indexing, knowledge-base, jira, sync

## Priority
High

## Story Points
8
