# Business Requirements Document (BRD)

## SDLC-Agents-4-Enterprise — SA4E-192: Slash Commands (Tier 2)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-192 |
| Title | Slash Commands (Tier 2) — /copy, /debug, /help, /init, /sessions, /skills, /status, /thinking |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-08-22 |
| Status | Draft (rebuilt from real Jira ticket) |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent – Business Analyst | Create document |
| Peer Reviewer | SA Agent – Solution Architect | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-22 | BA Agent | Rebuilt BRD from SA4E-192 Jira ticket (previous pipeline was built for wrong feature) |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |

---

## 1. Introduction

### 1.1 Scope

Implement **8 should-have slash commands** (Tier 2) to enhance the developer experience inside the agent/CLI shell. The commands are registered in a `SlashMenuController` and provide quick access to transcript copy, debug metrics, help, project init, session switching, skills listing, status panel, and thinking-toggle.

### 1.2 Out of Scope

- Tier 1 commands (already implemented) and any Tier 3 commands.
- Backend server changes beyond what is required to surface metrics (token usage, tool calls, hook fires, steering rules).
- Persistence model changes for sessions beyond what `SessionManager` already provides.

### 1.3 Preliminary Requirement

- Existing `SlashMenuController` registration mechanism.
- Existing `SessionManager` for session list/switch.
- Existing `.code-intel` structure conventions (for `/init` and `/skills`).
- Clipboard access capability in the host environment.

---

## 2. Business Requirements

### 2.1 High Level Process Map

User types `/<command>` → `SlashMenuController` routes to handler → handler executes action → result rendered in chat (or clipboard/system). Each command must be registered and discoverable via `/help`.

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|------------------|----------|---------------|
| 1 | As a developer, I want `/copy` to copy the chat transcript as markdown to clipboard | SHOULD HAVE | SA4E-192 |
| 2 | As a developer, I want `/debug` to show runtime metrics | SHOULD HAVE | SA4E-192 |
| 3 | As a developer, I want `/help` to list all commands | SHOULD HAVE | SA4E-192 |
| 4 | As a developer, I want `/init` to scaffold `.code-intel` | SHOULD HAVE | SA4E-192 |
| 5 | As a developer, I want `/sessions` to list/switch sessions | SHOULD HAVE | SA4E-192 |
| 6 | As a developer, I want `/skills` to list/invoke skills | SHOULD HAVE | SA4E-192 |
| 7 | As a developer, I want `/status` to show connection/tool/hook/agent counts | SHOULD HAVE | SA4E-192 |
| 8 | As a developer, I want `/thinking` to toggle extended thinking display | SHOULD HAVE | SA4E-192 |

---

### 2.3 Details of User Stories

#### STORY 1: /copy — Copy transcript
> As a developer, I want to copy the chat history to the clipboard as markdown so that I can paste it elsewhere.

**Requirement Details:**
1. Format the entire chat history as Markdown.
2. Copy to system clipboard.
3. Show a confirmation message.

**Acceptance Criteria:**
- [ ] `/copy` formats chat as markdown, copies to clipboard, shows confirmation.

#### STORY 2: /debug — Debug info
> As a developer, I want a debug panel so that I can inspect runtime metrics.

**Requirement Details:**
1. Show token usage (in/out).
2. Show tool-call count.
3. Show hook fires.
4. Show active steering rules.

**Acceptance Criteria:**
- [ ] `/debug` panel shows runtime metrics (tokens in/out, tool calls, duration).

#### STORY 3: /help — Help
> As a developer, I want help so that I can discover available commands.

**Acceptance Criteria:**
- [ ] `/help` lists all slash commands with descriptions and shortcuts.

#### STORY 4: /init — Project init
> As a developer, I want a first-time init wizard so that my project is configured.

**Acceptance Criteria:**
- [ ] `/init` creates `.code-intel/` folder structure with example files.

#### STORY 5: /sessions — Switch session
> As a developer, I want to manage sessions so that I can switch context.

**Acceptance Criteria:**
- [ ] `/sessions` shows session list from SessionManager, allows switch.

#### STORY 6: /skills — Skills list
> As a developer, I want to browse skills so that I can invoke them directly.

**Acceptance Criteria:**
- [ ] `/skills` lists skills from `.code-intel/skills/`, allows invoke.

#### STORY 7: /status — Status panel
> As a developer, I want a status panel so that I know system health.

**Acceptance Criteria:**
- [ ] `/status` shows server connection, tool count, hook count, agent count.

#### STORY 8: /thinking — Toggle thinking
> As a developer, I want to toggle thinking so that I can control verbosity.

**Acceptance Criteria:**
- [ ] `/thinking` toggles extended thinking display in chat messages.

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| SlashMenuController | System | N/A | Registration/routing of slash commands |
| SessionManager | System | N/A | Provides session list and switch |
| .code-intel structure | Infrastructure | N/A | Target for /init and source for /skills |
| Clipboard API | External | N/A | Required by /copy |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Developer (user) | Agent/CLI users | Consumes slash commands | Jira reporter |
| BA Agent | Business Analyst | BRD author | Pipeline |
| SA Agent | Solution Architect | Design/TDD | Pipeline |
| Dev Agent | Developer | Implementation | Pipeline |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Clipboard access blocked in some environments | Medium | Medium | Graceful fallback message if copy fails |
| Extended thinking toggle exposes internal reasoning unintentionally | Low | Low | Ensure toggle only affects display, not logging |
| Command name collision with future Tier 3 | Low | Low | Namespace review in SlashMenuController |

### 5.2 Assumptions

- `SlashMenuController`, `SessionManager`, and `.code-intel` conventions already exist.
- Host environment provides clipboard capability.

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Command response < 200ms for local actions | /help, /status, /thinking must be instant |
| Security | No command injection via args | All command args validated/escaped |
| Security | Clipboard data exposure | /copy must not leak secrets; confirmation shown |
| Usability | Discoverability | All 8 commands listed in /help |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| SA4E-192 | Slash Commands (Tier 2) | To Do | Story | Main ticket |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| SlashMenuController | Component that registers and routes `/` commands |
| SessionManager | Component managing chat sessions |
| .code-intel | Project metadata folder for skills/context |

### Reference Documents

| Document | Link / Location |
|----------|-----------------|
| Jira SA4E-192 | https://jiraassist.atlassian.net/browse/SA4E-192 |
