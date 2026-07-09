# Copilot Instructions — SDLC-Agents-4-Enterprise

## Concise Responses
- Short, direct answers. Skip lengthy explanations unless asked.
- Code changes: show code + 1-2 sentence summary.
- Questions: 2-5 sentences max.
- End-of-task summaries: max 3 sentences.

## Code Standards (All Languages)

### Size Limits
- **File: max 200 lines** — split by responsibility if exceeded
- **Function: max 20 lines** — split into smaller functions

### Folder Structure
- `models/` — Data classes, DTOs, enums, interfaces
- `pages/views/` — Page controllers
- `components/` — Reusable UI
- `api/clients/` — HTTP client
- `services/` — Business logic
- `utils/` — Pure utility functions

### SOLID (MANDATORY)
- S: Single Responsibility per class
- O: Open/Closed
- L: Liskov Substitution
- I: Interface Segregation
- D: Dependency Inversion

### Exception Handling
- NEVER swallow exceptions
- ALWAYS inform user of errors
- Specific validation messages

### Serialization
- Protocol/API: include ALL fields
- Shared serializer per module

## SM Agent Entry Point
Jira ticket key or implement/review/test → delegate to SM agent pipeline.

## Dynamic Tool Execution
1. `find_tools(query)` → discover
2. `execute_dynamic_tool(tool_name, arguments)` → execute
- NEVER call nested tools directly

## Draw.io Diagrams
- NEVER Mermaid — draw.io only
- Store at `documents/{TICKET}/diagrams/`
- XML: No self-closing edges, no mxfile wrapper

## SDLC Phases
1→BRD, 2→FSD, 3→TDD, 4→STP/STC, 5→Code, 6→Test, 7→Deploy

## Quality Gates
- Verify after each agent, Critical checks required, max 2 retries

## Circuit Breaker
- SM checks state before each phase: closed→execute, open→STOP, half-open→1 retry
- 3 failures → open. User "retry" → reset. 30min cooldown → half-open.

## Run Log
- SM appends to `documents/{TICKET}/RUN-LOG.md` after EVERY sub-agent call
- Never truncate — append only

## Token Budget
- dailyCap: 500k. Modes: normal (<80%), report-only (80-99%), stopped (≥100%)
- SM checks budget BEFORE every invoke

## Autonomy Levels
- L1 (Report): status only, no agents
- L2 (Assisted, default): agents + ask user per phase
- L3 (Unattended): full pipeline, stops at UAT/Deploy/circuit breaker

## Domain Glossary (Phase 1)
- BA extracts ≥5 domain terms into KB after BRD
- All agents search glossary before producing output

## Two-Axis Code Review (Phase 6)
- Axis 1 (Standards): DEV reviews SOLID, Fowler smells, size limits
- Axis 2 (Spec Compliance): QA checks TDD/FSD coverage, scope creep
- Both PASS → QA tests. FAIL → DEV fixes (max 2 iterations)

## Jira Integration
- Dynamic transitions (never hardcode)
- Comment on every transition
- Link related tickets

## Self-Learning
- Search KB before acting
- find_tools with min 3 attempts
- Ingest new learnings

## No Workaround Rule
- Fix root cause, not symptoms
- Single source of truth

## Release
- Bump versions before tag, test locally, semver
