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

- [ ] **AC-1**: QuickPick "Index Workspace" menu hiển thị option "Index Jira Project" (unchecked by default)
- [ ] **AC-2**: Khi chọn, user được prompt nhập Project Key (InputBox với validation)
- [ ] **AC-3**: Paginated fetch tất cả tickets trong project (JQL `project = KEY`)
- [ ] **AC-4**: Per ticket: fetch linked issues (inward + outward) với max depth = 2, anti-loop via visitedSet
- [ ] **AC-5**: Per ticket: fetch all comments, convert ADF → Markdown, output summary format `[date] @author: summary`
- [ ] **AC-6**: Per ticket: download text-based attachments (.md, .txt, .json, .csv, .yml) — convert .docx/.xlsx/.pdf via ConvertToolResolver
- [ ] **AC-7**: Per ticket: ingest 3 KB entries (metadata, comments, links) với scope=PROJECT
- [ ] **AC-8**: KB entry `source` field format: `jira/{PROJECT}/{KEY}/{type}` (searchable via mem_search)
- [ ] **AC-9**: Incremental sync: chỉ fetch tickets có `updated > lastSyncDate` (trừ lần đầu = full)
- [ ] **AC-10**: Linked tickets ngoài project: full-deep (desc + comments + links) nhưng không download attachment
- [ ] **AC-11**: Progress reporting: status bar + output channel hiển thị tiến trình (fetched X/Y, ingesting...)
- [ ] **AC-12**: Error handling: network errors, rate limits (429) → retry with backoff, partial results reported
- [ ] **AC-13**: Comment body scan phát hiện ticket references → add vào links entry
- [ ] **AC-14**: ADF fallback: nếu ADF parse fail → dùng renderedBody HTML → strip tags

---

## Labels
indexing, knowledge-base, jira, sync

## Priority
High

## Story Points
8
