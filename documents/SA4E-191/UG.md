# User Guide (UG)

## SA4E — SA4E-191: Slash Commands (Tier 1) — `/agents`, `/compact`, `/diff`, `/models`, `/new`, `/review`, `/undo`

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-191 |
| Title | Slash Commands (Tier 1) |
| Author | DEV Agent |
| Reviewer | BA Agent |
| Version | 1.0 |
| Date | 2026-08-23 |
| Status | Draft |
| Related BRD | documents/SA4E-191/BRD.md |
| Related FSD | documents/SA4E-191/FSD.md |
| Related TDD | documents/SA4E-191/TDD.md |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-23 | DEV Agent | Initial document, derived from implementation + FSD/BRD/TDD. |

---

## 1. Overview

The **SA4E-191 Slash Commands (Tier 1)** feature delivers seven productivity commands for the AI Chat Assistant inside the VS Code / Kiro extension. The commands are **implemented** as a self-contained, unit-tested module located at `extension/src/chat/slash-commands/`: a `CommandRegistry`, seven command handlers (`/agents`, `/compact`, `/diff`, `/models`, `/new`, `/review`, `/undo`), the adapters that talk to the underlying engines, and the supporting stores.

This module is a **library** intended to be consumed by the host chat shell. For the commands to be reachable at runtime, the host shell must:

1. Construct a `CommandRegistry` and assemble a `SlashCommandDeps` (the session, chat-exchange, agent, compaction, file-change, model-preference, model-registry, UI, and VCS dependencies),
2. Call `registerCommands(registry, deps)` to register the seven handlers, and
3. Route the `/` slash-menu (and the keyboard shortcuts) through `CommandRegistry.dispatch` so that a typed command is delivered to the matching handler.

> **Runtime reachability (important).** The SA4E-191 module is implemented and unit-tested, but the wiring above is **not part of this ticket**. As of this version, `registerCommands(registry, deps)` is not invoked by any production code path in the extension, and the live slash menu is not connected to these handlers. **Until the host chat shell performs the wiring described above, the seven commands are not reachable in the running extension.** (See §11, Open Item 7.)

The seven commands are:

| Command | Purpose | Shortcut | Owner-only |
|---------|---------|----------|------------|
| `/agents` | Switch the active agent | `Ctrl/Cmd+Shift+A` | No |
| `/compact` | Compact the current session | `Ctrl/Cmd+Shift+C` | No |
| `/diff` | Open the session file-change viewer | `Ctrl/Cmd+Shift+D` | No |
| `/models` | Switch the active LLM model (persisted) | `Ctrl/Cmd+Shift+M` | No |
| `/new` | Start a new (empty) session | `Ctrl/Cmd+Shift+N` | No |
| `/review` | Run a code review on the current branch diff | `Ctrl/Cmd+Shift+R` | **Yes** |
| `/undo` | Undo the last exchange (optionally revert files) | `Ctrl/Cmd+Shift+U` | **Yes** |

> **Dependency note.** Three commands depend on engines delivered by other tickets:
> - `/agents` → **SA4E-186** (Agent Runtime Routing)
> - `/compact` → **SA4E-182** (Compaction Service)
> - `/diff` and `/undo` (file revert) → **SA4E-183** (File Change Tracking)
>
> If the relevant engine is unavailable, the affected command reports a friendly error (see §7) and leaves your session untouched. `/models` and `/new` are fully self-contained.

---

## 2. Installation / Prerequisites

This feature ships **inside the SA4E extension** — there is no separate installation step for the end user.

### 2.1 Prerequisites

| Prerequisite | Required | Notes |
|--------------|----------|-------|
| The SA4E extension installed and activated | Yes | VS Code or Kiro host. |
| An authenticated chat session | Yes | All commands require an authenticated session (NFR-03). |
| Chat input focused | Yes | The `/` trigger must be intercepted by the host chat shell and routed through `CommandRegistry.dispatch` (see §1 runtime-reachability note). |
| Underlying engine (SA4E-182/183/186) | For `/agents`, `/compact`, `/diff`, `/review`, `/undo` file-revert | The command still appears; it reports a graceful error if the engine is down. |

### 2.2 How to invoke a command

> **Precondition.** The steps below describe how a user invokes a command **once the host chat shell is wired to the SA4E-191 module** (see the runtime-reachability note in §1). Until that wiring exists, none of these commands are reachable in the running extension.

1. Click into the **chat input** box of the AI Chat Assistant panel.
2. Type **`/`** — the slash menu opens (the host shell must route the `/` trigger, and the resulting selection, through `CommandRegistry.dispatch`).
3. Either:
    - Type the rest of the command (e.g. `agents`) and press **Enter**,
    - Pick the command from the menu with the mouse, or
    - Use its **keyboard shortcut** (e.g. `Ctrl/Cmd+Shift+A` for `/agents`).
4. Follow the on-screen picker / confirmation dialog / panel.

> **Note on the UI boundary.** The command logic lives in `extension/src/chat/slash-commands/` and communicates with the chat shell through a `SlashCommandUI` interface (`confirm`, `pickAgent`, `pickModel`, `showDiffViewer`, `showToast`, `showBadge`, `showEmptyChat`, `showChatBlock`). The actual dialogs, pickers, toasts, badges, and panels are rendered by the host chat shell's implementation of that interface. The behaviors described below are what the user sees once that shell is wired in.

---

## 3. Command Reference

> **Precondition.** The per-command descriptions below assume the host chat shell has been wired to the SA4E-191 module as described in §1 (runtime reachability). Until that wiring exists, none of these commands are reachable in the running extension. The "How to invoke" lines describe the intended invocation once the shell is connected.

### 3.1 `/agents` — Switch the active agent

- **Purpose:** List the agents available from SA4E-186 and set one as the active agent for subsequent turns.
- **Shortcut:** `Ctrl/Cmd+Shift+A`
- **How to invoke:** Type `/agents` + Enter, select from the menu, or press the shortcut.
- **Behavior:**
  1. The command requests the agent list from SA4E-186 (`listAgents()`).
  2. An **agent picker** opens, listing every available agent. (You can filter by typing in the picker.)
  3. Selecting an agent sets `ChatSession.activeAgentId` and shows a toast: **"Active agent switched to {agent}."**
  4. Pressing **Esc / clicking outside** cancels silently — no change is made.
- **Owner-only:** No.
- **Dependency:** Requires **SA4E-186**. If routing is down *or* the returned list is empty, you see: *"Agent switching is temporarily unavailable."*
- **Edge cases:** If you somehow select an agent that is not in the list, you get: *"Selected agent is not available."*

### 3.2 `/compact` — Compact the current session

- **Purpose:** Summarize and compress the current session context to reduce token usage while preserving conversational intent (via SA4E-182).
- **Shortcut:** `Ctrl/Cmd+Shift+C`
- **How to invoke:** Type `/compact` + Enter, select from the menu, or press the shortcut.
- **Behavior:**
  1. If the session has **no messages**, it reports: *"Nothing to compact."* and exits.
  2. The command estimates the context size (≈ 1 token per 4 characters). If it exceeds the **compaction threshold (1000 tokens)**, a confirmation dialog appears: *"Compact session? Large context detected."*
     - **Confirm** → compaction runs.
     - **Cancel** → nothing happens (no compaction).
  3. On success, the session context is replaced by the summary and a **"Compacted"** badge is shown.
- **On failure:** *"Session compaction failed. Please try again."*
- **Owner-only:** No.
- **Dependency:** Requires **SA4E-182**.

### 3.3 `/diff` — Session file-change viewer

- **Purpose:** Open a viewer showing file changes tracked during the current session (via SA4E-183).
- **Shortcut:** `Ctrl/Cmd+Shift+D`
- **How to invoke:** Type `/diff` + Enter, select from the menu, or press the shortcut.
- **Behavior:**
  1. The command queries SA4E-183 for `DiffEntry` records of the session.
  2. A **diff viewer panel** opens. Each file is listed with its status (`added` / `modified` / `deleted`) and can be expanded/collapsed.
  3. If there are **no changes**, the viewer still opens but shows the empty-state message: *"No file changes in this session."*
- **On tracking unavailable:** *"No change tracking data available for this session."*
- **Owner-only:** No.
- **Dependency:** Requires **SA4E-183**.

### 3.4 `/models` — Switch the active LLM model (persisted)

- **Purpose:** Open a model picker, set the active model, and **persist the choice** so future sessions default to it.
- **Shortcut:** `Ctrl/Cmd+Shift+M`
- **How to invoke:** Type `/models` + Enter, select from the menu, or press the shortcut.
- **Behavior:**
  1. A **model picker** opens with the current model registry (label + provider).
  2. Selecting a model sets `ChatSession.activeModelId` and **persists it to your user preferences** (keyed by `userId`). A toast confirms: *"Model set to {model} (saved)."*
  3. Pressing **Esc / clicking outside** cancels silently — your current model is kept.
- **On invalid selection:** *"Selected model is not available."*
- **On persistence failure:** *"Model preference could not be saved, but is active for this session."* — the model **is** active for the current session even though it was not saved.
- **On load (next session):** The persisted model is validated against the current registry. If it is no longer valid, the command silently falls back to the default model (see §4 / Deviation D-4).
- **Owner-only:** No.
- **Dependency:** None (self-contained; persistence uses the extension's preference store).

### 3.5 `/new` — Start a new session

- **Purpose:** Start a fresh session: clears visible messages and accumulated context.
- **Shortcut:** `Ctrl/Cmd+Shift+N`
- **How to invoke:** Type `/new` + Enter, select from the menu, or press the shortcut.
- **Behavior:**
  1. A **confirmation dialog** always appears (mandatory): *"Start a new session? Current chat will be cleared."*
     - **Confirm** → the chat is reset, context/history are cleared, a new empty session begins, and an empty-chat panel is shown.
     - **Cancel** → nothing happens (your current session is kept).
  2. If a failure occurs mid-reset, the previous session is **restored** automatically and you see: *"Session reset failed; previous chat restored."*
- **Owner-only:** No.
- **Dependency:** None (self-contained).

### 3.6 `/review` — Code review via agent (owner-only)

- **Purpose:** Run a dedicated review agent on the current branch diff; findings stream into the conversation.
- **Shortcut:** `Ctrl/Cmd+Shift+R`
- **How to invoke:** Type `/review` + Enter, select from the menu, or press the shortcut.
- **Owner-only:** **Yes.** The command is disabled (and rejected) for non-owners. Non-owner invocation → *"Permission denied."*
- **Behavior:**
  1. The branch diff is taken from the command arguments, or resolved from the **VCS provider** (the chat shell supplies the current branch + diff).
  2. If no diff can be obtained → *"Unable to obtain branch diff for review."*
  3. The review agent is resolved via SA4E-186. If unavailable → *"Review agent is currently unavailable."*
  4. On success, the agent analyzes the diff and **streams findings** (issues/suggestions) into a chat block. (If the diff is empty/clean, the agent reports no issues.)
- **Dependency:** Requires **SA4E-186** (review agent) and a working VCS provider for the branch diff.

### 3.7 `/undo` — Undo the last exchange (owner-only)

- **Purpose:** Remove the last user + agent message pair. If that exchange produced file changes (tracked by SA4E-183), optionally revert them.
- **Shortcut:** `Ctrl/Cmd+Shift+U`
- **How to invoke:** Type `/undo` + Enter, select from the menu, or press the shortcut.
- **Owner-only:** **Yes.** Non-owner invocation → *"Permission denied."*
- **Behavior:**
  1. If there is **no prior exchange**, it reports: *"Nothing to undo."* and exits (no-op).
  2. The command looks up file changes associated with that exchange (via SA4E-183).
  3. If file changes exist **and** you requested a revert, a confirmation prompt appears: *"Revert N file change(s)?"*
     - **Confirm** → each file change is reverted (bounded to the first 10 entries; 3 s budget per entry).
     - **Cancel** → only the exchange is removed; files are kept.
  4. The last exchange pair is removed and a toast confirms: *"Last exchange undone."*
  5. If some file changes could not be reverted (partial failure or over the cap), you get a warning: *"Exchange removed, but some file changes could not be reverted."* — the exchange is still removed.
- **Dependency:** File **revert** requires **SA4E-183**; the core removal of the exchange does not.

---

## 4. Configuration

For **end users**, the feature requires no configuration — once the host chat shell is wired to the SA4E-191 module (see §1 runtime-reachability note), the commands require no setup and work as described below when the extension and the underlying engines are available. (Until that wiring exists, the commands are not reachable in the running extension.) The only persisted user state is the **model preference** (`/models`), stored automatically per user in the extension's preference store and re-applied (with validation) on the next session.

For **developers / extension maintainers** who wire the module into the chat shell, the relevant configuration surfaces are:

### 4.1 Command descriptor shape (`SlashCommandDescriptor`)

Each command is registered once via `CommandRegistry.register(descriptor, handler)`. The descriptor contract (from `types.ts`) is:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Command id, e.g. `"agents"`. Must be unique (BR-1). |
| `label` | `string` | Menu label, e.g. `"/agents"`. |
| `icon` | `string` | Icon key shown in the menu. |
| `description` | `string` | Human-readable description. |
| `shortcutHint` | `string` | Unique keyboard hint, e.g. `"Ctrl/Cmd+Shift+A"` (BR-2 — enforced; duplicate throws). |
| `category` | `string` | Menu grouping (`"agent"` / `"session"` / `"model"` / `"review"`). |
| `requiresOwner` | `boolean` | `true` for `/review` and `/undo` (BR-4/BR-5). |
| `timeoutMs` | `number` | Per-command timeout (see §4.3). |

### 4.2 Dependencies injected at registration (`SlashCommandDeps`)

`registerCommands(registry, deps)` expects:

| Dependency | Purpose |
|------------|---------|
| `session` (`SessionStore`) | Holds `ChatSessionSnapshot` (active agent/model, context/history refs). |
| `chat` (`ChatExchangeStore`) | Tracks exchanges for `/undo` and clears them for `/new`. |
| `agentAdapter` (`AgentRouterAdapter`) | SA4E-186: `listAgents`, `resolve`, `runReview`. |
| `compactionAdapter` (`CompactionAdapter`) | SA4E-182: `compact`. |
| `fileAdapter` (`FileChangeAdapter`) | SA4E-183: `queryDiffs`, `revert`. |
| `modelPrefs` (`ModelPreferenceStore`) | Persists model choice per user (BR-6). |
| `modelRegistry` (`() => ModelChoice[]`) | Supplies the available models for the picker. |
| `ui` (`SlashCommandUI`) | Renders dialogs/pickers/toasts/panels (see §2.2 note). |
| `vcs` (`VcsProvider`) | Resolves the current branch diff for `/review`. |

### 4.3 Per-command timeouts and resilience (non-user-tunable)

These are hard-coded in the descriptors / adapters and are **not** exposed as user settings:

| Command | Timeout | Engine | Circuit breaker |
|---------|---------|--------|-----------------|
| `/agents` | 5 s | SA4E-186 | OPEN after 3 fails, probe 30 s |
| `/compact` | 10 s | SA4E-182 | optional degrade |
| `/diff` | 3 s | SA4E-183 | OPEN after 3 fails, probe 30 s |
| `/models` | 1 s | — | — |
| `/new` | 1 s | — | — |
| `/review` | 5 s | SA4E-186 | OPEN after 3 fails, probe 30 s |
| `/undo` | 30 s | SA4E-183 (3 s/entry, ≤10 entries) | OPEN after 3 fails, probe 30 s |

- **Rate limit:** 20 requests / minute / session / command (token-bucket). Surplus → *"Too many requests, please wait."*
- **Compaction threshold:** The "large context" confirmation triggers above **1000 estimated tokens** (≈ 4000 characters of context). This value is hard-coded in `CompactCommand` (not configurable).

---

## 5. Examples

**Example 1 — `/agents`**
> Type `/agents` (or `Ctrl/Cmd+Shift+A`) → the agent picker opens → choose `agent_reviewer` → toast: *"Active agent switched to agent_reviewer."* Subsequent turns route to that agent.

**Example 2 — `/compact`**
> After a long conversation, type `/compact` → because the context exceeds the threshold, a dialog appears: *"Compact session? Large context detected."* → Confirm → a **"Compacted"** badge appears and the session continues with a summarized context.

**Example 3 — `/diff`**
> Type `/diff` → the diff viewer panel opens showing `src/app.ts` as `modified`, `src/util.ts` as `added`. If nothing changed this session, the panel shows: *"No file changes in this session."*

**Example 4 — `/models` (persistence)**
> Type `/models` → pick `claude-sonnet` → toast: *"Model set to claude-sonnet (saved)."* The choice is persisted for your user. After `/new` or an app restart, `claude-sonnet` is the default (validated against the registry; invalid → silently falls back to the default model).

**Example 5 — `/new`**
> Type `/new` → confirm *"Start a new session? Current chat will be cleared."* → the chat clears and a fresh empty session begins.

**Example 6 — `/review` (owner)**
> As the session **owner**, type `/review` → the current branch diff is captured → the review agent streams findings such as *"Line 42: possible null dereference."* into the conversation. As a **non-owner**, the same command returns *"Permission denied."*

**Example 7 — `/undo` (owner, with revert)**
> As the session **owner**, after an exchange that edited `src/app.ts`, type `/undo` → a prompt appears: *"Revert 1 file change(s)?"* → Confirm → `src/app.ts` is reverted, the exchange is removed, and you see *"Last exchange undone."* If you had no prior exchange, you get *"Nothing to undo."*

---

## 6. Troubleshooting

| # | Symptom | Likely Cause | Solution |
|---|---------|--------------|----------|
| 1 | *"Agent switching is temporarily unavailable."* | SA4E-186 routing is down, or no agents are returned. | Wait for SA4E-186 to recover; retry. The command does not change your active agent. |
| 2 | *"Session compaction failed. Please try again."* | SA4E-182 compaction error/timeout. | Retry `/compact`. Your context is left untouched. |
| 3 | *"Nothing to compact."* | The session has no messages yet. | Send at least one message, then compact. |
| 4 | *"No change tracking data available for this session."* | SA4E-183 tracking is unavailable. | Ensure SA4E-183 is running; retry `/diff`. |
| 5 | Diff viewer shows *"No file changes in this session."* | No file edits were tracked this session. | This is expected when nothing changed; not an error. |
| 6 | *"Model preference could not be saved, but is active for this session."* | The preference store write failed. | The model is active now; the choice won't persist to future sessions. Check extension storage permissions. |
| 7 | *"Session reset failed; previous chat restored."* | A failure occurred mid-reset. | Your previous session was restored automatically. Retry `/new`. |
| 8 | *"Unable to obtain branch diff for review."* | No VCS context / branch diff could not be resolved. | Ensure you are on a branch with a diff vs. base, and the VCS provider is wired in. |
| 9 | *"Review agent is currently unavailable."* | SA4E-186 review agent unreachable. | Wait and retry `/review`. |
| 10 | *"Permission denied."* (on `/review` or `/undo`) | You are not the session owner. | Only the session owner can run `/review` and `/undo`. |
| 11 | *"Nothing to undo."* | No prior exchange in the session. | Send a message first, then `/undo`. |
| 12 | *"Too many requests, please wait."* | You exceeded 20 invocations/min for that command in this session. | Wait a moment and retry. |
| 13 | A command you expected is disabled/greyed out | Owner-only command while non-owner, or engine dependency down. | See §3.6/§3.7 (owner) or the relevant dependency note. |

---

## 7. Error Codes / Messages

Stable error `code` values are returned in the `error.code` field of each `CommandResult` and surfaced to you as the `userMessage`. The first ten are the codes specified in the FSD technical contracts; the remaining rows are additional codes present in the implementation (see §9, Deviations D-1/D-2).

| Code | User Message | Meaning | Remedy |
|------|-------------|---------|--------|
| `AGENT_ROUTING_UNAVAILABLE` | Agent switching is temporarily unavailable. | SA4E-186 unreachable or returned no agents. | Retry when routing is healthy. |
| `COMPACTION_FAILED` | Session compaction failed. Please try again. | SA4E-182 compaction error/timeout. | Retry; context unchanged. |
| `NOTHING_TO_COMPACT` | Nothing to compact. | Session has no messages. | Add messages, then compact. |
| `TRACKING_UNAVAILABLE` | No change tracking data available for this session. | SA4E-183 unavailable. | Ensure SA4E-183 is running; retry. |
| `PREF_PERSIST_FAILED` | Model preference could not be saved, but is active for this session. | Preference store write failed. | Model active now; not persisted. Check storage. |
| `RESET_FAILED` | Session reset failed; previous chat restored. | Mid-operation failure in `/new`. | Previous session restored; retry. |
| `BRANCH_DIFF_UNAVAILABLE` | Unable to obtain branch diff for review. | No branch diff resolvable. | Provide VCS context / diff. |
| `REVIEW_AGENT_UNAVAILABLE` | Review agent is currently unavailable. | SA4E-186 review agent unreachable. | Retry when agent is healthy. |
| `PERMISSION_DENIED` | Permission denied. | Non-owner invoked `/review` or `/undo`. | Run as the session owner. |
| `NOTHING_TO_UNDO` | Nothing to undo. | No prior exchange exists. | Send a message, then undo. |
| `INVALID_AGENT` * | Selected agent is not available. | Picked agent not in the available list. | Pick a listed agent. |
| `INVALID_MODEL` * | Selected model is not available. | Picked model not in the registry. | Pick a listed model. |
| `RATE_LIMITED` * | Too many requests, please wait. | > 20 req/min/session/command. | Wait, then retry. |
| `UNKNOWN_COMMAND` * | Unknown command. | Command id not registered. | Use one of the 7 commands. |
| `HANDLER_ERROR` * | *(raw error message)* | An unexpected error escaped the handler. | See Dev Note D-3; report to support. |

\* *Not part of the FSD §3.x.7 error-code list — added by the implementation (see §9).*

---

## 8. FAQ

**Q: Do I have to memorize the commands?**  
A: Once the host chat shell is wired to the SA4E-191 module (see §1), you won't have to — typing `/` in the chat input opens a menu that shows every command with its description and shortcut hint, and you can filter by typing. Until that wiring exists, the commands are not reachable at runtime.

**Q: Why is `/review` or `/undo` greyed out / denied?**  
A: Both are **owner-only** (BR-5). If you are not the session owner, they are disabled and return *"Permission denied."*

**Q: Will `/compact` lose my conversation?**  
A: It summarizes to preserve intent; it does not delete your ability to continue. If it fails, your context is left untouched.

**Q: Why didn't my model choice stick after restart?**  
A: If persistence failed you'd have seen *"Model preference could not be saved…"* If the saved model is no longer in the registry on next load, it silently falls back to the default model.

**Q: Is there a limit to how many file changes `/undo` reverts?**  
A: Up to the first **10** tracked file changes for the exchange are reverted (≈30 s budget). Any beyond that are skipped and surfaced in the warning message.

**Q: What happens if I spam a command?**  
A: A token-bucket rate limiter allows 20 invocations per minute per session per command; beyond that you get *"Too many requests, please wait."*

---

## 9. Administration / Audit

### 9.1 Audit trail

Every command invocation — success **and** failure — emits one structured audit event through the registry's audit sink:

```json
{
  "event": "slash.command",
  "userId": "usr_12",
  "command": "undo",
  "ts": "2026-08-23T10:00:00Z",
  "target": "sess_8f2a1c",
  "status": "ok",
  "durationMs": 42
}
```

- `event` is always `"slash.command"`.
- `target` is the affected session (or resource) id.
- No PII beyond `userId` / `command` / `target` is recorded.
- **Retention:** The FSD (§7.3) specifies a **90-day** retention. See Deviation D-5 for the current implementation state.

### 9.2 Owner enforcement & resilience (admin view)

- **Owner-only** commands (`/review`, `/undo`) are enforced in two places: the menu disables them for non-owners, and the `CommandRegistry.dispatch` re-checks `requiresOwner` as defense-in-depth.
- **Circuit breakers** wrap engine calls (SA4E-186 / SA4E-183): after 3 consecutive failures the breaker opens and fails fast with the friendly message; it probes again after 30 s.
- **Timeouts** (§4.3) prevent a hung engine from blocking the UI.

---

## 10. Documented Deviations from FSD (for BA review)

The following behaviors were implemented differently from (or in addition to) what the FSD strictly implies. Listed so the BA reviewer can reconcile spec vs. implementation.

- **D-1 — Extra error codes `INVALID_AGENT` / `INVALID_MODEL`.** The FSD §3.x.7 error-code lists do not include these, though FSD §9.1 references the message *"Selected agent is not available."* The implementation returns explicit `INVALID_AGENT` / `INVALID_MODEL` codes (not the dependency-unavailable code) when a picker selection is not in the available set.
- **D-2 — Registry-level error codes not in FSD.** `RATE_LIMITED`, `UNKNOWN_COMMAND`, and `HANDLER_ERROR` are produced by `CommandRegistry` (rate limit, unknown id, unexpected handler throw) and are not enumerated in the FSD error tables.
- **D-3 — `HANDLER_ERROR` may surface a raw message.** When a handler throws an unexpected error, `dispatch` returns `HANDLER_ERROR` with the raw error message as `userMessage`. The FSD (§3.9) says raw stack traces must never reach the UI; engine errors are properly mapped, but a non-engine handler exception would currently surface its raw message. Recommend a generic user message for `HANDLER_ERROR` in a follow-up.
- **D-4 — `/models` invalid-on-load fallback is silent.** FSD §3.4.6 (EF-2) says *"Saved model unavailable; using default."* should notify the user. The implementation (`ModelPreferenceStore.resolveValidModelId`) silently returns the default model without a notification.
- **D-5 — Audit retention not yet persisted.** FSD §7.3 requires a 90-day retention. The current `InMemoryAuditSink` only appends to an in-memory list and writes a `console.debug` line; it does **not** persist or enforce retention. Production wiring must replace the sink (e.g., with a host-side persisted sink) to meet the 90-day requirement.
- **D-6 — UI rendering is delegated.** The module defines the `SlashCommandUI` boundary and ships a `NoopSlashCommandUI`. The real dialogs/pickers/toasts/panels are supplied by the host chat shell; this UG describes the intended user-visible behavior once that shell is wired.
- **D-7 — `/review` VCS provider default is "unavailable".** The default `VcsProvider` (`UnavailableVcsProvider`) returns `null`, so `/review` reports `BRANCH_DIFF_UNAVAILABLE` unless the chat shell injects a real VCS provider.
- **D-8 — Compaction threshold is hard-coded.** FSD §3.2 notes the threshold is "configurable"; the implementation uses a fixed `COMPACTION_THRESHOLD = 1000` tokens in `CompactCommand`.

---

## 11. Known Limitations / Open Items

This section consolidates the genuine gaps between the implementation and the FSD that a **user or product owner** should be aware of. These are derived from the deviations listed in §10 (D-3, D-4, D-5, D-6, D-7, D-8) and reflect items that are **not yet fully delivered** by the module on its own — most require the host chat shell or a follow-up to close.

| # | Limitation | What it means for you | Status / Owner |
|---|------------|-----------------------|----------------|
| 1 | **Audit log is not persisted** | Every command emits an audit event, but today it is only kept in memory and printed to the debug console. The FSD's required **90-day retention (§7.3)** is **not** enforced yet. | Open — needs a persisted host-side audit sink. |
| 2 | **UI must be wired by the host shell** | The module defines the `SlashCommandUI` boundary and ships a no-op placeholder (`NoopSlashCommandUI`). The actual dialogs, pickers, toasts, badges, and panels only appear once the host chat shell supplies a real implementation. | Open — host shell integration required. |
| 3 | **`/review` needs a real VCS provider** | The default VCS provider returns nothing, so `/review` reports *"Unable to obtain branch diff for review."* (`BRANCH_DIFF_UNAVAILABLE`) unless the shell injects a working VCS provider. | Open — shell must inject a VCS provider. |
| 4 | **Compaction threshold is fixed** | The "large context" confirmation triggers at a hard-coded **1000 tokens**. The FSD describes this as configurable, but there is no setting to change it yet. | Open — follow-up to make it configurable. |
| 5 | **`/models` silent fallback on load** | If your saved model is no longer valid at next launch, the command switches to the default model **silently**. The FSD (EF-2) expects a *"Saved model unavailable; using default."* notification to the user. | Open — follow-up to surface the notification. |
| 6 | **Rare raw error message possible** | In uncommon cases where an unexpected internal error occurs, the command may show a raw technical message (`HANDLER_ERROR`) instead of a friendly one. The FSD states raw traces should never reach the UI. | Open — follow-up to mask with a generic message. |
| 7 | **Registration call site not wired in this ticket (SA4E-191)** | `registerCommands(registry, deps)` is never invoked by any production code path in this ticket; the seven handlers are implemented but not registered into any live registry, and the live slash menu is not connected to them. Until the host chat shell constructs a `CommandRegistry` + `SlashCommandDeps`, calls `registerCommands`, and routes `/` through `CommandRegistry.dispatch`, the commands are not reachable at runtime. | Open — owner: host-shell integration. |

> **Note.** Items 1–3 and 7 are environmental/integration dependencies (the module is built to be embedded and relies on the host shell for persistence, UI, VCS, and the registration call site). Items 4–6 are implementation gaps that should be closed in a follow-up release. Item 7 in particular is the gating integration step: the seven commands are not reachable until the host shell performs the wiring described in §1. Once the host shell is wired in, none of these block the seven commands from working.

---

*End of UG — Version 1.0 (Draft). Generated by DEV Agent for SA4E-191.*
