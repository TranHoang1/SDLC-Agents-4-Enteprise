# Functional Specification Document (FSD)

## SDLC-Agents-4-Enterprise — SA4E-192: Slash Commands (Tier 2)

| Jira Ticket | SA4E-192 |
|-------------|----------|
| Title | Slash Commands (Tier 2) — /copy, /debug, /help, /init, /sessions, /skills, /status, /thinking |
| Author | BA Agent / SA Agent |
| Version | 1.0 |
| Date | 2026-08-22 |
| Related BRD | brd/SA4E-192/BRD.md |

---

## 1. Overview
Eight slash commands registered in `SlashMenuController`, each with a handler. Commands operate on the existing agent/CLI runtime (SessionManager, .code-intel, tool/hook registry).

## 2. Functional Requirements

| ID | Command | Input | Behavior | Output |
|----|---------|-------|----------|--------|
| FR-1 | /copy | none | Serialize chat history to Markdown, write to clipboard | Confirmation toast |
| FR-2 | /debug | none | Collect metrics: tokens in/out, tool calls, duration, hook fires, steering rules | Rendered panel |
| FR-3 | /help | none | Enumerate registered commands + description + shortcut | List in chat |
| FR-4 | /init | none | Create `.code-intel/` with example `skills/`, `context/`, `steering/` | Success message |
| FR-5 | /sessions | [id?] | List sessions from SessionManager; if id given, switch | List / switch confirmation |
| FR-6 | /skills | [name?] | List `.code-intel/skills/`; if name given, invoke | List / invoke result |
| FR-7 | /status | none | Show connection, tool count, hook count, agent count, steering count | Status panel |
| FR-8 | /thinking | none | Toggle `extendedThinking` display flag for session | Toggle confirmation |

## 3. Non-Functional
- All local commands respond < 200ms.
- Clipboard writes must fail gracefully with message.
- No command argument is passed to a shell未经 escaping (prevent injection).

## 4. UI / Interaction
- Commands entered in chat input prefixed with `/`.
- `/help` output includes shortcuts (e.g., `Ctrl+H` optional).
- `/thinking` state persists for the session.

## 5. Data Model
- Session: {id, name, createdAt, messages[]}
- Skill: {name, path, description}
- Metrics: {tokensIn, tokensOut, toolCalls, durationMs, hookFires, steeringRules[]}

## 6. Error Handling
- Clipboard unavailable → "Copy failed: clipboard not accessible"
- Invalid session/skill id → "Not found"
- Unregistered command → "Unknown command, try /help"
