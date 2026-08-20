# Software Test Cases (STC)

## SA4E-183: File Change Tracking — Session-wide diff summary visualization

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-183 |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2025-07-27 |
| Related STP | STP-v1-SA4E-183.docx |

---

## 1. PBT — Property-Based Testing

### PBT-01: Entry count never exceeds MAX_FILES (100)

| Attribute | Value |
|-----------|-------|
| **ID** | PBT-01 |
| **Level** | PBT |
| **Priority** | Critical |
| **Covers** | BR-03 |
| **Precondition** | DiffTracker instantiated with mock bridge |
| **Property** | For any sequence of N recordChange calls (N ∈ [0, 500]), entries.size ≤ 100 |
| **Generator** | Arbitrary array of RecordChangeInput with random filePaths and operations |
| **Iterations** | 1000 |
| **Expected** | Property holds for all generated inputs |

### PBT-02: Summary totals consistent with entries

| Attribute | Value |
|-----------|-------|
| **ID** | PBT-02 |
| **Level** | PBT |
| **Priority** | Critical |
| **Covers** | BR-10 |
| **Precondition** | DiffTracker with arbitrary entries recorded |
| **Property** | getSummary().totalFiles === getSummary().totalAdded + getSummary().totalModified + getSummary().totalDeleted |
| **Generator** | Sequence of 1-100 recordChange calls with random operations |
| **Iterations** | 1000 |
| **Expected** | Equality holds for all inputs |

### PBT-03: Net-zero rule (added then deleted removes entry)

| Attribute | Value |
|-----------|-------|
| **ID** | PBT-03 |
| **Level** | PBT |
| **Priority** | High |
| **Covers** | FSD AF-02 |
| **Precondition** | DiffTracker empty |
| **Property** | For any filePath: recordChange(path, 'added') then recordChange(path, 'deleted') → getFileCount() === 0 |
| **Generator** | Arbitrary non-empty string paths |
| **Iterations** | 1000 |
| **Expected** | Property holds; entry removed completely |

### PBT-04: clearSession always produces empty state

| Attribute | Value |
|-----------|-------|
| **ID** | PBT-04 |
| **Level** | PBT |
| **Priority** | Critical |
| **Covers** | BR-04 |
| **Precondition** | DiffTracker with arbitrary entries |
| **Property** | After clearSession(): getFileCount() === 0 AND getSummary().entries.length === 0 |
| **Generator** | Arbitrary pre-fill of 0-100 entries, then clearSession() |
| **Iterations** | 1000 |
| **Expected** | Always empty after clear |

### PBT-05: truncateDiff output ≤ maxSize

| Attribute | Value |
|-----------|-------|
| **ID** | PBT-05 |
| **Level** | PBT |
| **Priority** | High |
| **Covers** | BR-09, OI-05 |
| **Precondition** | diff-utils imported |
| **Property** | For any string s and maxSize > 0: truncateDiff(s, maxSize).length ≤ maxSize |
| **Generator** | Arbitrary strings (0-5MB), maxSize ∈ [1, 2*1024*1024] |
| **Iterations** | 1000 |
| **Expected** | Output always within bounds |

### PBT-06: getFileCount consistency

| Attribute | Value |
|-----------|-------|
| **ID** | PBT-06 |
| **Level** | PBT |
| **Priority** | High |
| **Covers** | IDiffTracker contract |
| **Precondition** | DiffTracker with arbitrary operations |
| **Property** | getFileCount() === getSummary().totalFiles at any point |
| **Generator** | Interleaved recordChange/clearSession calls |
| **Iterations** | 1000 |
| **Expected** | Always consistent |

### PBT-07: Eviction preserves newest entries

| Attribute | Value |
|-----------|-------|
| **ID** | PBT-07 |
| **Level** | PBT |
| **Priority** | Medium |
| **Covers** | BR-03, FSD AF-03 |
| **Precondition** | DiffTracker empty |
| **Property** | After recording 150 unique files sequentially, entries contain files 51-150 (newest 100) |
| **Generator** | Sequential paths `file-001.ts` to `file-150.ts` with increasing timestamps |
| **Iterations** | 100 |
| **Expected** | Oldest 50 evicted |

---

## 2. UT — Unit Tests

### STC-01: Record single file addition

| Attribute | Value |
|-----------|-------|
| **ID** | STC-01 |
| **Level** | UT |
| **Priority** | Critical |
| **Covers** | BR-01, BR-10, US-1 |
| **Precondition** | DiffTracker instantiated, empty state, mock bridge |
| **Steps** | 1. Call `recordChange({ filePath: 'src/new.ts', operation: 'added', linesAdded: 10, linesRemoved: 0, diffContent: '+...' })` |
| **Expected** | getFileCount() === 1; getSummary().totalAdded === 1; entry.operation === 'added' |

### STC-02: Record single file modification

| Attribute | Value |
|-----------|-------|
| **ID** | STC-02 |
| **Level** | UT |
| **Priority** | Critical |
| **Covers** | BR-01, BR-10, US-1 |
| **Precondition** | DiffTracker instantiated, empty state |
| **Steps** | 1. Call `recordChange({ filePath: 'src/existing.ts', operation: 'modified', linesAdded: 5, linesRemoved: 3, diffContent: '@@ -1,3 +1,5 @@...', originalContent: 'original' })` |
| **Expected** | getFileCount() === 1; getSummary().totalModified === 1; getOriginalContent('src/existing.ts') === 'original' |

### STC-03: Record single file deletion

| Attribute | Value |
|-----------|-------|
| **ID** | STC-03 |
| **Level** | UT |
| **Priority** | Critical |
| **Covers** | BR-01, BR-10, US-1 |
| **Precondition** | DiffTracker instantiated, empty state |
| **Steps** | 1. Call `recordChange({ filePath: 'src/old.ts', operation: 'deleted', linesAdded: 0, linesRemoved: 50, diffContent: '-...' })` |
| **Expected** | getFileCount() === 1; getSummary().totalDeleted === 1 |

### STC-04: Cumulative merge — same file modified twice

| Attribute | Value |
|-----------|-------|
| **ID** | STC-04 |
| **Level** | UT |
| **Priority** | Critical |
| **Covers** | BR-02, BR-07, US-1 |
| **Precondition** | DiffTracker with one entry for 'src/a.ts' (modified, +5/-2) |
| **Steps** | 1. Call `recordChange({ filePath: 'src/a.ts', operation: 'modified', linesAdded: 8, linesRemoved: 4, diffContent: 'cumulative-diff' })` |
| **Expected** | getFileCount() === 1 (not 2); entry.linesAdded === 8; entry.linesRemoved === 4; entry.diffContent === 'cumulative-diff' |

### STC-05: Record multiple different files

| Attribute | Value |
|-----------|-------|
| **ID** | STC-05 |
| **Level** | UT |
| **Priority** | Critical |
| **Covers** | US-1 |
| **Precondition** | DiffTracker empty |
| **Steps** | 1. Record 'src/a.ts' (added) 2. Record 'src/b.ts' (modified) 3. Record 'src/c.ts' (deleted) |
| **Expected** | getFileCount() === 3; totalAdded=1, totalModified=1, totalDeleted=1 |

### STC-06: Failed tool result — not recorded

| Attribute | Value |
|-----------|-------|
| **ID** | STC-06 |
| **Level** | UT |
| **Priority** | Critical |
| **Covers** | BR-01, BR-08 |
| **Precondition** | DiffTracker empty |
| **Steps** | 1. Simulate tool result starting with "Error:" 2. Verify buildChangeEntry returns null 3. Verify getFileCount() === 0 |
| **Expected** | No entry recorded |

### STC-07: Max 100 files — eviction triggered

| Attribute | Value |
|-----------|-------|
| **ID** | STC-07 |
| **Level** | UT |
| **Priority** | High |
| **Covers** | BR-03, FSD AF-03 |
| **Precondition** | DiffTracker with exactly 100 entries |
| **Steps** | 1. Record file #101 with newest timestamp |
| **Expected** | getFileCount() === 100; oldest entry (by timestamp) removed; newest entry present |

### STC-08: Eviction — 101st file with correct oldest removal

| Attribute | Value |
|-----------|-------|
| **ID** | STC-08 |
| **Level** | UT |
| **Priority** | High |
| **Covers** | BR-03 |
| **Precondition** | DiffTracker with 100 entries, timestamps 1-100 |
| **Steps** | 1. Record new entry with timestamp 101 |
| **Expected** | Entry with timestamp 1 evicted; entry with timestamp 101 present |

### STC-09: Memory cap — diffContent truncated at 2MB

| Attribute | Value |
|-----------|-------|
| **ID** | STC-09 |
| **Level** | UT |
| **Priority** | High |
| **Covers** | BR-09, OI-05, SEC-05 |
| **Precondition** | DiffTracker empty |
| **Steps** | 1. Record entry with diffContent = 3MB string |
| **Expected** | Stored diffContent ≤ 2MB; ends with "[diff truncated — too large]" |

### STC-10: Invalid input — empty filePath discarded

| Attribute | Value |
|-----------|-------|
| **ID** | STC-10 |
| **Level** | UT |
| **Priority** | High |
| **Covers** | FSD EF-02 |
| **Precondition** | DiffTracker empty |
| **Steps** | 1. Call `recordChange({ filePath: '', operation: 'added', ... })` |
| **Expected** | getFileCount() === 0; no error thrown |

### STC-11: Invalid input — invalid operation discarded

| Attribute | Value |
|-----------|-------|
| **ID** | STC-11 |
| **Level** | UT |
| **Priority** | High |
| **Covers** | FSD EF-02 |
| **Precondition** | DiffTracker empty |
| **Steps** | 1. Call `recordChange({ filePath: 'x.ts', operation: 'unknown' as any, ... })` |
| **Expected** | getFileCount() === 0; no error thrown |

### STC-12: Net-zero — added then deleted removes both

| Attribute | Value |
|-----------|-------|
| **ID** | STC-12 |
| **Level** | UT |
| **Priority** | High |
| **Covers** | FSD AF-02 |
| **Precondition** | DiffTracker empty |
| **Steps** | 1. Record 'new.ts' operation='added' 2. Record 'new.ts' operation='deleted' |
| **Expected** | getFileCount() === 0; getSummary().entries is empty |

### STC-13: Deleted then re-created — becomes 'added'

| Attribute | Value |
|-----------|-------|
| **ID** | STC-13 |
| **Level** | UT |
| **Priority** | High |
| **Covers** | FSD AF-01 |
| **Precondition** | DiffTracker with 'file.ts' operation='deleted' |
| **Steps** | 1. Record 'file.ts' operation='added' |
| **Expected** | getFileCount() === 1; entry.operation === 'added' |

### STC-39: getSummary with empty state

| Attribute | Value |
|-----------|-------|
| **ID** | STC-39 |
| **Level** | UT |
| **Priority** | High |
| **Covers** | US-1, FSD AF-01 (UC-02) |
| **Precondition** | DiffTracker empty |
| **Steps** | 1. Call getSummary() |
| **Expected** | totalFiles=0, totalAdded=0, totalModified=0, totalDeleted=0, entries=[] |

### STC-40: getOriginalContent returns stored content

| Attribute | Value |
|-----------|-------|
| **ID** | STC-40 |
| **Level** | UT |
| **Priority** | Critical |
| **Covers** | BR-22, US-4 |
| **Precondition** | DiffTracker with 'src/a.ts' recorded with originalContent='hello world' |
| **Steps** | 1. Call getOriginalContent('src/a.ts') |
| **Expected** | Returns 'hello world' |

### STC-41: Three modifications to same file — single cumulative entry

| Attribute | Value |
|-----------|-------|
| **ID** | STC-41 |
| **Level** | UT |
| **Priority** | High |
| **Covers** | BR-02 |
| **Precondition** | DiffTracker empty |
| **Steps** | 1. Record 'a.ts' modified (+2/-1) 2. Record 'a.ts' modified (+5/-3) 3. Record 'a.ts' modified (+10/-7) |
| **Expected** | getFileCount()===1; entry.linesAdded===10; entry.linesRemoved===7 (latest cumulative) |

### STC-42: computeUnifiedDiff produces valid unified format

| Attribute | Value |
|-----------|-------|
| **ID** | STC-42 |
| **Level** | UT |
| **Priority** | High |
| **Covers** | BR-15 |
| **Precondition** | diff-utils module imported |
| **Steps** | 1. Call computeUnifiedDiff('line1\nline2', 'line1\nline3\nline4') |
| **Expected** | Output starts with '---' / '+++'; contains '@@ ' hunk headers; '+' for additions, '-' for removals |

### STC-43: Debounce timer — rapid calls produce single badge update

| Attribute | Value |
|-----------|-------|
| **ID** | STC-43 |
| **Level** | UT |
| **Priority** | High |
| **Covers** | BR-06 |
| **Precondition** | DiffTracker with mock bridge, vi.useFakeTimers() |
| **Steps** | 1. Record 5 files in rapid succession (no timer advance) 2. Advance timer by 99ms 3. Verify bridge.postToWebview NOT called 4. Advance timer by 1ms (total 100ms) |
| **Expected** | bridge.postToWebview called exactly ONCE with count=5 |

### STC-44: Denied tool result — not recorded

| Attribute | Value |
|-----------|-------|
| **ID** | STC-44 |
| **Level** | UT |
| **Priority** | High |
| **Covers** | BR-08 |
| **Precondition** | DiffTracker empty |
| **Steps** | 1. Simulate tool result starting with "Denied" 2. Verify buildChangeEntry returns null |
| **Expected** | No entry recorded |

### STC-54: originalContent capped at 2MB

| Attribute | Value |
|-----------|-------|
| **ID** | STC-54 |
| **Level** | UT |
| **Priority** | Medium |
| **Covers** | SEC-05, BR-09 |
| **Precondition** | DiffTracker empty |
| **Steps** | 1. Record entry with originalContent = 3MB string |
| **Expected** | Stored originalContent.length ≤ 2MB |

---

## 3. E2E-UI — Svelte Component Tests

### STC-14: DiffEntryRow — expand shows unified diff content

| Attribute | Value |
|-----------|-------|
| **ID** | STC-14 |
| **Level** | E2E-UI |
| **Priority** | Critical |
| **Covers** | BR-15, BR-07, US-2 |
| **Precondition** | DiffEntryRow rendered with entry { filePath: 'src/a.ts', operation: 'modified', diffContent: '@@ -1,2 +1,3 @@\n context\n-old\n+new\n+added' } |
| **Steps** | 1. Click expand chevron |
| **Expected** | Diff content area visible; contains diff lines with proper formatting |

### STC-15: DiffEntryRow — added file shows all green

| Attribute | Value |
|-----------|-------|
| **ID** | STC-15 |
| **Level** | E2E-UI |
| **Priority** | High |
| **Covers** | BR-16, US-2 |
| **Precondition** | DiffEntryRow with operation='added', diffContent all '+' lines |
| **Steps** | 1. Expand entry |
| **Expected** | All diff lines have addition styling (green background class) |

### STC-16: DiffEntryRow — deleted file shows all red

| Attribute | Value |
|-----------|-------|
| **ID** | STC-16 |
| **Level** | E2E-UI |
| **Priority** | High |
| **Covers** | BR-16, US-2 |
| **Precondition** | DiffEntryRow with operation='deleted', diffContent all '-' lines |
| **Steps** | 1. Expand entry |
| **Expected** | All diff lines have removal styling (red background class) |

### STC-17: DiffEntryRow — large diff (>500 lines) collapsed by default

| Attribute | Value |
|-----------|-------|
| **ID** | STC-17 |
| **Level** | E2E-UI |
| **Priority** | Medium |
| **Covers** | BR-17, US-2 |
| **Precondition** | DiffEntryRow with diffContent = 600 lines |
| **Steps** | 1. Render component 2. Click expand chevron |
| **Expected** | Diff area shows collapse message: "600 lines changed — Show full diff"; full content NOT rendered until "Show full diff" clicked |

### STC-18: DiffEntryRow — syntax highlighting based on file extension

| Attribute | Value |
|-----------|-------|
| **ID** | STC-18 |
| **Level** | E2E-UI |
| **Priority** | Low |
| **Covers** | BR-18, US-2 |
| **Precondition** | DiffEntryRow with filePath='src/app.tsx' |
| **Steps** | 1. Expand entry |
| **Expected** | Diff content area has language class (e.g., `language-tsx`) applied |

### STC-19: SlashMenu — /diff appears in autocomplete

| Attribute | Value |
|-----------|-------|
| **ID** | STC-19 |
| **Level** | E2E-UI |
| **Priority** | Critical |
| **Covers** | BR-11, BR-14, US-3 |
| **Precondition** | SlashMenuItems imported |
| **Steps** | 1. Find entry with id='command-diff' in SLASH_COMMANDS |
| **Expected** | Entry found; label='diff'; description='Show session file changes'; itemType='command' |

### STC-28: ChangeBadge — hidden when fileCount=0

| Attribute | Value |
|-----------|-------|
| **ID** | STC-28 |
| **Level** | E2E-UI |
| **Priority** | Critical |
| **Covers** | BR-23, US-5 |
| **Precondition** | ChangeBadge rendered with fileCount=0 |
| **Steps** | 1. Query for badge element |
| **Expected** | Badge element not visible (display:none or not rendered) |

### STC-29: ChangeBadge — visible with correct count when fileCount>0

| Attribute | Value |
|-----------|-------|
| **ID** | STC-29 |
| **Level** | E2E-UI |
| **Priority** | Critical |
| **Covers** | BR-23, US-5 |
| **Precondition** | ChangeBadge rendered with fileCount=5 |
| **Steps** | 1. Query for badge element |
| **Expected** | Badge visible; counter text content === '5' |

### STC-30: ChangeBadge — updates reactively on store change

| Attribute | Value |
|-----------|-------|
| **ID** | STC-30 |
| **Level** | E2E-UI |
| **Priority** | High |
| **Covers** | BR-24, US-5 |
| **Precondition** | ChangeBadge rendered, diffTrackerStore.fileCount=2 |
| **Steps** | 1. Update store: diffTrackerStore.updateCount(7) |
| **Expected** | Badge counter updates to '7' |

### STC-31: ChangeBadge — click dispatches diff command

| Attribute | Value |
|-----------|-------|
| **ID** | STC-31 |
| **Level** | E2E-UI |
| **Priority** | High |
| **Covers** | BR-25, US-5 |
| **Precondition** | ChangeBadge rendered with fileCount=3, postMessage spy |
| **Steps** | 1. Click badge element |
| **Expected** | postMessage called with { type: 'COMMAND_DISPATCH', command: 'diff' } |

### STC-32: ChangeBadge — ARIA label correct

| Attribute | Value |
|-----------|-------|
| **ID** | STC-32 |
| **Level** | E2E-UI |
| **Priority** | Low |
| **Covers** | BR-26, BRD NFR Usability |
| **Precondition** | ChangeBadge rendered with fileCount=3 |
| **Steps** | 1. Check aria-label attribute |
| **Expected** | aria-label === '3 files changed in this session' |

### STC-37: DiffSummaryPanel — files grouped by operation, sorted alphabetically

| Attribute | Value |
|-----------|-------|
| **ID** | STC-37 |
| **Level** | E2E-UI |
| **Priority** | High |
| **Covers** | BR-29, BR-31, US-7 |
| **Precondition** | DiffSummaryPanel rendered with entries: ['z.ts' added, 'a.ts' added, 'b.ts' modified, 'c.ts' deleted] |
| **Steps** | 1. Render panel |
| **Expected** | Sections in order: Added (a.ts, z.ts) → Modified (b.ts) → Deleted (c.ts); within each section alphabetical |

### STC-38: DiffSummaryPanel — empty sections hidden

| Attribute | Value |
|-----------|-------|
| **ID** | STC-38 |
| **Level** | E2E-UI |
| **Priority** | High |
| **Covers** | BR-30, US-7 |
| **Precondition** | DiffSummaryPanel with entries: only 'modified' operations (no added/deleted) |
| **Steps** | 1. Render panel |
| **Expected** | Only "Modified" section visible; "Added" and "Deleted" sections NOT in DOM |

---

## 4. Security Test Cases

### STC-45: Path traversal — absolute path rejected

| Attribute | Value |
|-----------|-------|
| **ID** | STC-45 |
| **Level** | UT |
| **Priority** | Critical |
| **Covers** | SEC-01 |
| **Precondition** | handleDiffOpenFile handler with workspace at 'C:\ws\project' |
| **Steps** | 1. Send DIFF_OPEN_FILE with filePath='C:\Windows\System32\config\SAM' |
| **Expected** | Handler rejects (logs warning, no file opened) |

### STC-46: Path traversal — dot-dot sequences rejected

| Attribute | Value |
|-----------|-------|
| **ID** | STC-46 |
| **Level** | UT |
| **Priority** | Critical |
| **Covers** | SEC-01 |
| **Precondition** | handleDiffOpenFile handler with workspace at 'C:\ws\project' |
| **Steps** | 1. Send DIFF_OPEN_FILE with filePath='../../etc/passwd' |
| **Expected** | Resolved path escapes workspace → rejected |

### STC-47: Path traversal — valid workspace path accepted

| Attribute | Value |
|-----------|-------|
| **ID** | STC-47 |
| **Level** | UT |
| **Priority** | High |
| **Covers** | SEC-01 |
| **Precondition** | handleDiffOpenFile handler, file exists in DiffTracker entries |
| **Steps** | 1. Send DIFF_OPEN_FILE with filePath='src/services/AuthService.ts', operation='modified' |
| **Expected** | Handler proceeds to open diff editor |

### STC-48: DiffOriginalProvider — unknown filePath returns empty

| Attribute | Value |
|-----------|-------|
| **ID** | STC-48 |
| **Level** | UT |
| **Priority** | High |
| **Covers** | SEC-02 |
| **Precondition** | DiffOriginalProvider with DiffTracker containing entries for 'src/a.ts' only |
| **Steps** | 1. Request content for URI `diff-original:/src/secret.ts` |
| **Expected** | Returns empty string '' (does not distinguish tracked vs non-tracked — prevents enumeration) |

### STC-49: DiffOriginalProvider — URI path normalization cross-platform

| Attribute | Value |
|-----------|-------|
| **ID** | STC-49 |
| **Level** | UT |
| **Priority** | Medium |
| **Covers** | SEC-02 |
| **Precondition** | DiffOriginalProvider with entry keyed as 'src/a.ts' |
| **Steps** | 1. Request content for URI `diff-original:/src/a.ts` (POSIX) 2. Request for `diff-original:src\\a.ts` (Windows) |
| **Expected** | Both resolve to same entry and return correct content |

### STC-50: Sensitive file — diffContent redacted for .env

| Attribute | Value |
|-----------|-------|
| **ID** | STC-50 |
| **Level** | UT |
| **Priority** | High |
| **Covers** | SEC-03 |
| **Precondition** | DiffTracker empty, isSensitiveFile implemented |
| **Steps** | 1. Record entry with filePath='.env', diffContent='API_KEY=secret123' |
| **Expected** | Stored entry.diffContent === '[Diff hidden — sensitive file]' |

### STC-51: Sensitive file — patterns matched (.pem, .key, credentials.json)

| Attribute | Value |
|-----------|-------|
| **ID** | STC-51 |
| **Level** | UT |
| **Priority** | Medium |
| **Covers** | SEC-03 |
| **Precondition** | isSensitiveFile function available |
| **Steps** | 1. Test 'server.pem' 2. Test 'id_rsa' 3. Test 'credentials.json' 4. Test '.env.local' 5. Test 'src/app.ts' (not sensitive) |
| **Expected** | 1-4 return true; 5 returns false |

### STC-52: PostMessage validation — invalid filePath type rejected

| Attribute | Value |
|-----------|-------|
| **ID** | STC-52 |
| **Level** | UT |
| **Priority** | Medium |
| **Covers** | SEC-04 |
| **Precondition** | DIFF_OPEN_FILE handler with zod validation |
| **Steps** | 1. Send message { type: 'DIFF_OPEN_FILE', filePath: 12345, operation: 'modified' } |
| **Expected** | Zod safeParse fails; handler returns early; no crash |

### STC-53: PostMessage validation — invalid operation value rejected

| Attribute | Value |
|-----------|-------|
| **ID** | STC-53 |
| **Level** | UT |
| **Priority** | Medium |
| **Covers** | SEC-04 |
| **Precondition** | DIFF_OPEN_FILE handler with zod validation |
| **Steps** | 1. Send message { type: 'DIFF_OPEN_FILE', filePath: 'a.ts', operation: 'exploit' } |
| **Expected** | Zod safeParse fails; handler returns early; no crash |

---

## 5. IT — Integration Tests

### STC-55: DiffTracker + SessionLifecycleEmitter — session:created resets state

| Attribute | Value |
|-----------|-------|
| **ID** | STC-55 |
| **Level** | IT |
| **Priority** | Critical |
| **Covers** | BR-04, BR-27, UC-06 |
| **Precondition** | Real DiffTracker + real SessionLifecycleEmitter wired together |
| **Steps** | 1. Record 5 entries 2. Emit 'session:created' event with new threadId |
| **Expected** | getFileCount()===0; badge message sent with count=0 |

### STC-56: DiffTracker + SessionLifecycleEmitter — session:hydrated preserves state

| Attribute | Value |
|-----------|-------|
| **ID** | STC-56 |
| **Level** | IT |
| **Priority** | Critical |
| **Covers** | BR-05, UC-06 AF-01 |
| **Precondition** | Real DiffTracker with 5 entries + real SessionLifecycleEmitter wired |
| **Steps** | 1. Emit 'session:hydrated' event |
| **Expected** | getFileCount()===5; entries unchanged |

### STC-57: DiffTracker debounce — real setTimeout behavior

| Attribute | Value |
|-----------|-------|
| **ID** | STC-57 |
| **Level** | IT |
| **Priority** | High |
| **Covers** | BR-06 |
| **Precondition** | Real DiffTracker with mock bridge (real timers) |
| **Steps** | 1. Record 3 entries rapidly 2. Wait 150ms |
| **Expected** | bridge.postToWebview called ≤2 times (debounce coalesced) |

### STC-58: DiffTracker + DiffOriginalProvider — content consistency

| Attribute | Value |
|-----------|-------|
| **ID** | STC-58 |
| **Level** | IT |
| **Priority** | High |
| **Covers** | BR-22, TDD §6.5 |
| **Precondition** | Real DiffTracker + real DiffOriginalProvider |
| **Steps** | 1. Record 'src/a.ts' with originalContent='original code' 2. Query DiffOriginalProvider for URI `diff-original:src/a.ts` |
| **Expected** | Provider returns 'original code' |

### STC-59: executeSingleTool → DiffTracker — write_file records modified

| Attribute | Value |
|-----------|-------|
| **ID** | STC-59 |
| **Level** | IT |
| **Priority** | Critical |
| **Covers** | TDD §6.1, BR-01 |
| **Precondition** | Mock executeSingleTool with DiffTracker injected; file pre-exists |
| **Steps** | 1. Execute 'write_file' tool with content 2. Verify DiffTracker.recordChange called with operation='modified' |
| **Expected** | Entry recorded; originalContent = pre-read file content |

### STC-60: executeSingleTool → DiffTracker — delete_file records deleted

| Attribute | Value |
|-----------|-------|
| **ID** | STC-60 |
| **Level** | IT |
| **Priority** | High |
| **Covers** | TDD §6.1 |
| **Precondition** | Mock executeSingleTool with DiffTracker; file exists |
| **Steps** | 1. Execute 'delete_file' tool |
| **Expected** | Entry recorded with operation='deleted'; originalContent = pre-read file |

### STC-61: ChatEngineAdapter — diff command dispatches summary

| Attribute | Value |
|-----------|-------|
| **ID** | STC-61 |
| **Level** | IT |
| **Priority** | Critical |
| **Covers** | TDD §6.2, UC-02 |
| **Precondition** | Real ChatEngineAdapter with real DiffTracker (has 3 entries) |
| **Steps** | 1. Simulate COMMAND_DISPATCH { command: 'diff' } message |
| **Expected** | bridge.postToWebview called with { type: 'DIFF_SUMMARY_RESPONSE', summary: { totalFiles: 3, ... } } |

### STC-62: ChatEngineAdapter — DIFF_OPEN_FILE modified opens diff editor

| Attribute | Value |
|-----------|-------|
| **ID** | STC-62 |
| **Level** | IT |
| **Priority** | High |
| **Covers** | TDD §6.3, UC-04, BR-19 |
| **Precondition** | Real ChatEngineAdapter with DiffTracker containing 'src/a.ts' originalContent |
| **Steps** | 1. Simulate DIFF_OPEN_FILE { filePath: 'src/a.ts', operation: 'modified' } |
| **Expected** | vscode.commands.executeCommand called with ('vscode.diff', originalUri, currentUri, title) |

---

## 6. E2E-API — PostMessage Protocol Tests

### STC-63: DIFF_COUNT_UPDATED message structure valid

| Attribute | Value |
|-----------|-------|
| **ID** | STC-63 |
| **Level** | E2E-API |
| **Priority** | Critical |
| **Covers** | TDD §3.2 |
| **Precondition** | DiffTracker with mock webview panel |
| **Steps** | 1. Record an entry 2. Advance debounce timer 3. Capture postMessage payload |
| **Expected** | Payload matches `{ type: 'DIFF_COUNT_UPDATED', count: 1 }` exactly |

### STC-64: DIFF_SUMMARY_RESPONSE message structure valid

| Attribute | Value |
|-----------|-------|
| **ID** | STC-64 |
| **Level** | E2E-API |
| **Priority** | Critical |
| **Covers** | TDD §3.2 |
| **Precondition** | DiffTracker with 2 entries (1 added, 1 modified) |
| **Steps** | 1. Dispatch 'diff' command 2. Capture postMessage payload |
| **Expected** | Payload matches DiffSummaryPayload schema; totalFiles=2, totalAdded=1, totalModified=1, entries.length=2 |

### STC-65: DIFF_OPEN_FILE for 'added' — opens normal editor

| Attribute | Value |
|-----------|-------|
| **ID** | STC-65 |
| **Level** | E2E-API |
| **Priority** | High |
| **Covers** | BR-20, UC-04 AF-01 |
| **Precondition** | ChatEngineAdapter with DiffTracker |
| **Steps** | 1. Send DIFF_OPEN_FILE { filePath: 'src/new.ts', operation: 'added' } |
| **Expected** | vscode.window.showTextDocument called (NOT vscode.diff) |

### STC-66: DIFF_OPEN_FILE for 'deleted' — shows notification

| Attribute | Value |
|-----------|-------|
| **ID** | STC-66 |
| **Level** | E2E-API |
| **Priority** | High |
| **Covers** | BR-21, UC-04 AF-02 |
| **Precondition** | ChatEngineAdapter |
| **Steps** | 1. Send DIFF_OPEN_FILE { filePath: 'src/old.ts', operation: 'deleted' } |
| **Expected** | vscode.window.showInformationMessage called with "File has been deleted: src/old.ts" |

### STC-67: DIFF_OPEN_FILE for 'modified' without originalContent — fallback to normal editor

| Attribute | Value |
|-----------|-------|
| **ID** | STC-67 |
| **Level** | E2E-API |
| **Priority** | Medium |
| **Covers** | UC-04 AF-03 |
| **Precondition** | DiffTracker.getOriginalContent returns undefined for path |
| **Steps** | 1. Send DIFF_OPEN_FILE { filePath: 'src/x.ts', operation: 'modified' } |
| **Expected** | vscode.window.showTextDocument called (fallback — no diff view) |

### STC-68: COMMAND_DISPATCH 'diff' with empty session

| Attribute | Value |
|-----------|-------|
| **ID** | STC-68 |
| **Level** | E2E-API |
| **Priority** | High |
| **Covers** | UC-02 AF-01 |
| **Precondition** | DiffTracker empty |
| **Steps** | 1. Dispatch COMMAND_DISPATCH { command: 'diff' } |
| **Expected** | DIFF_SUMMARY_RESPONSE sent with totalFiles=0, entries=[] |

### STC-69: COMMAND_DISPATCH non-diff command — passes through to VS Code

| Attribute | Value |
|-----------|-------|
| **ID** | STC-69 |
| **Level** | E2E-API |
| **Priority** | Medium |
| **Covers** | TDD §6.2 (existing behavior preserved) |
| **Precondition** | ChatEngineAdapter |
| **Steps** | 1. Dispatch COMMAND_DISPATCH { command: 'compact' } |
| **Expected** | vscode.commands.executeCommand called with 'compact' (NOT intercepted by diff logic) |

---

## 7. SIT — System Integration Tests

### SIT-01: Complete flow — tool execution to diff panel render

| Attribute | Value |
|-----------|-------|
| **ID** | SIT-01 |
| **Level** | SIT |
| **Priority** | Critical |
| **Covers** | US-1, US-2, US-3 (full flow) |
| **Precondition** | Full extension wired: DiffTracker + ChatEngineAdapter + mock webview + mock tool execution |
| **Steps** | 1. Simulate write_file tool success on 'src/a.ts' 2. Simulate str_replace tool success on 'src/b.ts' 3. Advance debounce timer 4. Verify DIFF_COUNT_UPDATED { count: 2 } sent 5. Dispatch '/diff' command 6. Verify DIFF_SUMMARY_RESPONSE with 2 entries |
| **Expected** | Full data flow works end-to-end |

### SIT-02: Session lifecycle — new session resets, badge hides

| Attribute | Value |
|-----------|-------|
| **ID** | SIT-02 |
| **Level** | SIT |
| **Priority** | Critical |
| **Covers** | US-6, BR-04, BR-23 |
| **Precondition** | Full extension wired, DiffTracker has 5 entries |
| **Steps** | 1. Trigger SessionLifecycleEmitter.emitSessionCreated('new-thread') 2. Advance debounce timer 3. Verify DIFF_COUNT_UPDATED { count: 0 } sent |
| **Expected** | State cleared; badge hidden |

### SIT-03: Stress — 100 files tracked, performance within targets

| Attribute | Value |
|-----------|-------|
| **ID** | SIT-03 |
| **Level** | SIT |
| **Priority** | High |
| **Covers** | BR-03, BR-12, BRD NFR Performance |
| **Precondition** | Full extension wired |
| **Steps** | 1. Record 100 unique file entries 2. Measure getSummary() execution time 3. Dispatch '/diff' command 4. Measure response time |
| **Expected** | getSummary() < 50ms; DIFF_SUMMARY_RESPONSE within 200ms |

### SIT-04: Rapid tool calls — 10 changes in 50ms, badge updates once

| Attribute | Value |
|-----------|-------|
| **ID** | SIT-04 |
| **Level** | SIT |
| **Priority** | High |
| **Covers** | BR-06, TDD §12.8 |
| **Precondition** | Full extension wired, vi.useFakeTimers() |
| **Steps** | 1. Record 10 entries within 50ms (no timer advance between) 2. Advance timer by 100ms |
| **Expected** | bridge.postToWebview called exactly 1 time with count=10 |

### SIT-05: Graceful degradation — DiffTracker disabled via feature flag

| Attribute | Value |
|-----------|-------|
| **ID** | SIT-05 |
| **Level** | SIT |
| **Priority** | Medium |
| **Covers** | TDD §10.1 |
| **Precondition** | Feature flag `sa4e183.diffTracker.enabled` = false |
| **Steps** | 1. Simulate tool execution (write_file success) 2. Dispatch '/diff' command |
| **Expected** | No entries recorded; summary response indicates "Feature disabled" or empty state; no errors thrown |

### SIT-06: /diff during active streaming — no interruption

| Attribute | Value |
|-----------|-------|
| **ID** | SIT-06 |
| **Level** | SIT |
| **Priority** | Medium |
| **Covers** | BR-13, UC-02 AF-02 |
| **Precondition** | Full extension wired, simulated active LLM stream in progress |
| **Steps** | 1. Start mock stream (isStreaming=true) 2. Dispatch '/diff' command |
| **Expected** | DIFF_SUMMARY_RESPONSE sent normally; stream continues uninterrupted |

---

## 8. Test Data Specifications

### 8.1 change-entries.csv

| filePath | operation | linesAdded | linesRemoved | description |
|----------|-----------|-----------|-------------|-------------|
| src/services/AuthService.ts | modified | 15 | 3 | Normal modification |
| src/models/User.ts | added | 42 | 0 | New file creation |
| src/deprecated/old.ts | deleted | 0 | 120 | File deletion |
| src/a.ts | modified | 5 | 2 | First edit (cumulative test) |
| src/a.ts | modified | 10 | 7 | Second edit (same file) |
| .env | modified | 1 | 1 | Sensitive file |
| server.pem | added | 30 | 0 | Sensitive file (certificate) |
| src/utils/deep/nested/path/file.ts | modified | 3 | 1 | Deep nested path |
| file with spaces.ts | modified | 2 | 1 | Space in filename |
| CHANGELOG.md | modified | 5 | 0 | Root-level file |

### 8.2 file-paths.csv (Security/Edge Cases)

| filePath | category | shouldAccept |
|----------|----------|--------------|
| src/app.ts | normal | true |
| src/services/AuthService.ts | normal | true |
| ../../etc/passwd | path-traversal | false |
| C:\Windows\System32\config\SAM | absolute-windows | false |
| /etc/shadow | absolute-unix | false |
| .env | sensitive | true (but redacted) |
| .env.local | sensitive | true (but redacted) |
| credentials.json | sensitive | true (but redacted) |
| id_rsa | sensitive | true (but redacted) |
| server.key | sensitive | true (but redacted) |
| node_modules/pkg/index.js | normal | true |
| (empty string) | invalid | false |
| src/../../../escape.txt | traversal-relative | false |

### 8.3 diff-content-samples.csv

| scenario | contentSize | description |
|----------|-------------|-------------|
| small | 50 bytes | Single line change |
| medium | 5KB | Typical function rewrite |
| large | 100KB | Module refactor |
| huge | 3MB | Over 2MB cap — triggers truncation |
| empty | 0 bytes | Edge case — empty diff |
| binary-like | 1KB | Non-UTF8 content |
| 500-lines | ~25KB | Exactly at collapse threshold |
| 501-lines | ~25.1KB | Just over collapse threshold |

---

## 9. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Test Coverage Matrix | [test-coverage.png](diagrams/test-coverage.png) | [test-coverage.drawio](diagrams/test-coverage.drawio) |
| 2 | Test Execution Flow | [test-execution-flow.png](diagrams/test-execution-flow.png) | [test-execution-flow.drawio](diagrams/test-execution-flow.drawio) |
