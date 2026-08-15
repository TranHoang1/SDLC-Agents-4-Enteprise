# Functional Specification Document (FSD)

## SDLC-Agents-4-Enterprise — SA4E-102: Index Jira Project → Knowledge Base

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-102 |
| Title | Index Jira Project → Knowledge Base |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-08-11 |
| Status | Draft |
| Related BRD | documents/SA4E-102/BRD.md |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-11 | BA Agent | Initiate document — derived from BRD v1.0 |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the "Index Jira Project → Knowledge Base" feature.
It translates BRD user stories into detailed use cases, data specifications, API contracts, and
integration flows that developers can implement directly.

### 1.2 Scope

- Full Batch Sync: user-triggered bulk indexing of all Jira project tickets
- On-demand Cache: transparent auto-ingest when `jira_get_issue` is called
- Upsert semantics: re-index updates entries, never duplicates
- Graph integration: TICKET nodes + relationship edges
- Progress feedback: Output panel + notification bar

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| KB | Knowledge Base — local SQLite with BM25 full-text search |
| Graph DB | Graph database for nodes and edges |
| mem_ingest | Backend MCP tool for ingesting content into KB |
| mem_graph | Backend MCP tool for managing graph nodes and edges |
| JQL | Jira Query Language |
| Upsert | Update if exists, insert if not |
| MCP | Model Context Protocol |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | documents/SA4E-102/BRD.md |
| IndexingService | extension/src/services/IndexingService.ts |
| IndexerHttpClient | extension/src/services/IndexerHttpClient.ts |
| Indexer entry point | extension/src/indexer.ts |

---

## 2. System Overview

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)

The system integrates 4 external boundaries:
- **User** triggers batch indexing via VS Code Command Palette
- **Atlassian MCP Server** provides Jira ticket data
- **Backend MCP Server** provides KB operations
- **KB + Graph DB** stores indexed entries and relationship graph

### 2.2 System Architecture

The feature extends the existing `IndexingService` with a new `JiraProjectIndexer`:

1. Extension layer: Quick Pick menu option + command registration
2. Service layer: `JiraProjectIndexer` orchestrates fetch → transform → ingest
3. Transport layer: `IndexerHttpClient` communicates with backend MCP
4. Storage layer: KB (SQLite BM25) + Graph DB (nodes/edges)

---

## 3. Functional Requirements

### 3.1 Use Cases Summary

| UC-ID | Name | Actor | BRD Story |
|-------|------|-------|-----------|
| UC-01 | Full Batch Sync | Developer | Story 1 |
| UC-02 | On-demand Cache | AI Agent | Story 2 |
| UC-03 | Upsert Entry | System | Story 3 |
| UC-04 | Create Graph Node | System | Story 4 |
| UC-05 | Create Graph Edge | System | Story 4 |
| UC-06 | Display Progress | System | Story 5 |
| UC-07 | Search Cached Ticket | AI Agent | Story 1, 2 |
---

### 3.2 UC-01: Full Batch Sync

**Use Case ID:** UC-01
**Actor:** Developer
**Preconditions:**
- Workspace open in VS Code
- Atlassian MCP server connected with valid credentials
- Backend MCP server running (port 48721)

**Postconditions:**
- All project tickets ingested into KB
- Graph nodes created for each ticket
- Output panel shows completion summary

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Opens Command Palette | | User initiates indexing |
| 2 | Selects "Index Jira Project" | | User picks Jira option |
| 3 | Enters Project Key | | User provides project key |
| 4 | | Executes JQL query with pagination | Fetch first batch (50) |
| 5 | | Transforms tickets to KB entry format | Transform loop |
| 6 | | Calls mem_ingest for batch | Ingest to KB |
| 7 | | Calls mem_graph for nodes + edges | Graph creation |
| 8 | | Repeats 4-7 until all tickets done | Pagination loop |
| 9 | | Displays summary in Output panel | Completion |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01.1 | Project key auto-detected from jira.conf | Skip step 3, pre-fill input box with detected key |
| AF-01.2 | User cancels input dialog | Abort indexing, no side effects |
| AF-01.3 | Project has 0 tickets | Show info message "No tickets found", complete |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01.1 | Atlassian MCP not connected | Show error "Jira not connected. Check Atlassian MCP settings.", abort |
| EF-01.2 | Invalid project key (JQL returns error) | Show error "Project {KEY} not found or no access", abort |
| EF-01.3 | Backend MCP unavailable | Show error "Backend server unreachable", abort |
| EF-01.4 | Single batch fails (network timeout) | Log error, skip batch, continue with next batch |
| EF-01.5 | Rate limited by Jira API | Wait 30s, retry batch (max 3 retries), then skip |

---

### 3.3 UC-02: On-demand Cache

**Use Case ID:** UC-02
**Actor:** AI Agent
**Preconditions:**
- Agent calls jira_get_issue(issue_key) tool
- Backend MCP server running

**Postconditions:**
- Ticket data returned to agent immediately
- Ticket data asynchronously ingested into KB
- Graph node created/updated for ticket

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Agent calls jira_get_issue("SA4E-100") | | Agent requests ticket |
| 2 | | Fetches ticket from Jira API | Normal tool execution |
| 3 | | Returns ticket data to agent | Immediate response |
| 4 | | (Async) Transforms ticket to KB format | Fire-and-forget |
| 5 | | (Async) Calls mem_ingest with upsert | Non-blocking ingest |
| 6 | | (Async) Updates/creates graph node | Non-blocking graph |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-02.1 | KB already has entry for this ticket | Upsert updates existing entry (UC-03) |
| AF-02.2 | Ticket has linked issues not yet in KB | Only create edges for tickets already in graph |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-02.1 | Async ingest fails | Log warning, do NOT affect agent response |
| EF-02.2 | Backend MCP unavailable during async | Log warning, skip ingest silently |
| EF-02.3 | Jira API returns error for get_issue | Return error to agent normally (no caching attempted) |

---

### 3.4 UC-03: Upsert Entry

**Use Case ID:** UC-03
**Actor:** System (internal)
**Preconditions:**
- Ticket data transformed to KB entry format
- Source identifier computed: jira/{PROJECT}/{TICKET_KEY}

**Postconditions:**
- Exactly one KB entry exists per ticket (no duplicates)
- Entry content reflects latest ticket state

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Compute source = jira/{PROJECT}/{KEY} | Unique identifier |
| 2 | | Call mem_ingest with source field | Backend handles upsert |
| 3 | | Backend checks existing entry by source | Deduplication check |
| 4 | | If exists: update content | Update path |
| 5 | | If not exists: create new entry | Insert path |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-03.1 | Entry exists but content unchanged | Still upsert (idempotent), no error |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-03.1 | mem_ingest returns error | Log error with ticket key, continue processing |

---

### 3.5 UC-04: Create Graph Node

**Use Case ID:** UC-04
**Actor:** System (internal)
**Preconditions:**
- Ticket successfully ingested into KB
- Graph DB available

**Postconditions:**
- One TICKET-type graph node exists per ticket
- Node metadata includes status, priority, assignee

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Compute node_id = jira-ticket-{KEY} | Deterministic ID |
| 2 | | Call mem_graph(action: "add_node") | Create/update node |
| 3 | | Set type=TICKET, label="{KEY}: {summary}" | Node attributes |
| 4 | | Set metadata: status, priority, assignee | Node metadata |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-04.1 | Node already exists (re-index) | Update label and metadata, no duplicate |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-04.1 | Graph DB unavailable | Log warning, skip graph creation, KB entry still valid |

---

### 3.6 UC-05: Create Graph Edge

**Use Case ID:** UC-05
**Actor:** System (internal)
**Preconditions:**
- Source ticket node exists in graph (UC-04 completed)
- Ticket has linked_issues data

**Postconditions:**
- Edges created between source ticket and linked tickets
- Edge types reflect Jira link types

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Read linked_issues from ticket data | Extract links |
| 2 | | For each link: determine edge type | Map Jira link → edge |
| 3 | | Check if target node exists in graph | Validate target |
| 4 | | Call mem_graph(action: "add_edge") | Create edge |

**Link Type → Edge Type Mapping:**

| Jira Link Type | Graph Edge Type | Direction |
|----------------|----------------|-----------|
| blocks / is blocked by | DEPENDS_ON | blocker → blocked |
| relates to | RELATES_TO | bidirectional |
| implements | IMPLEMENTS | ticket → code ref |
| duplicates | RELATES_TO | source → duplicate |
| clones | RELATES_TO | source → clone |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-05.1 | Target ticket not yet indexed | Create edge anyway (dangling until target indexed) |
| AF-05.2 | Edge already exists (re-index) | Skip (idempotent) |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-05.1 | mem_graph add_edge fails | Log warning, continue with other edges |

---

### 3.7 UC-06: Display Progress

**Use Case ID:** UC-06
**Actor:** System (internal, during UC-01)
**Preconditions:**
- Batch sync in progress (UC-01 active)

**Postconditions:**
- User sees real-time progress in Output panel
- Notification bar shows percentage
- Summary displayed at completion

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Show notification bar "Indexing Jira tickets... 0/{total}" | Init progress |
| 2 | | Per batch: log "Fetched batch {N}: {start}-{end} of {total}" | Batch log |
| 3 | | Per ticket: log "Ingested: {KEY} - {summary}" (verbose) | Ticket log |
| 4 | | Update notification "{indexed}/{total}" | Progress update |
| 5 | | On complete: summary in Output panel | Final summary |

**Summary Format:**
`
✅ Jira Project Indexing Complete: {ingested} tickets, {errors} errors, {graphs} graph nodes
`

**Error Log Format:**
`
⚠️ Failed to ingest {TICKET_KEY}: {error_message}
`

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-06.1 | Verbose mode disabled | Skip per-ticket logging (step 3) |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-06.1 | Output channel not available | Fall back to console.log |

---

### 3.8 UC-07: Search Cached Ticket

**Use Case ID:** UC-07
**Actor:** AI Agent
**Preconditions:**
- Ticket has been previously indexed (via UC-01 or UC-02)

**Postconditions:**
- Agent receives ticket info from KB without Jira API call

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Agent calls mem_search("{TICKET_KEY}") | | Search KB |
| 2 | | KB returns matching entry with ticket data | BM25 match |
| 3 | Agent uses ticket info for task | | No Jira API needed |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-07.1 | Ticket not in KB | Agent falls back to jira_get_issue (triggers UC-02) |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-07.1 | KB search returns stale data | Agent can re-fetch via jira_get_issue to refresh |
