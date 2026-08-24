# Software Test Plan (STP)

## SA4E-192 — Slash Commands (Tier 2)

| Ticket | SA4E-192 | Version | 1.0 |
|--------|----------|---------|-----|

## 1. Test Scope
Validate all 8 slash commands register correctly and meet acceptance criteria.

## 2. Test Approach
- **Unit**: each handler with mocked `CommandContext`.
- **Integration**: SlashMenuController routing + SessionManager + skills dir.
- **Manual/CLI**: invoke commands in a live session.

## 3. Entry / Exit Criteria
- Entry: FSD + TDD approved.
- Exit: all AC checked, no high/critical defects open.

## 4. Environment
- Node/TS runtime with clipboard mock.
- `.code-intel/skills/` sample present.

## 5. Responsibilities
- QA Agent: author STC, execute, report.
- Dev Agent: fix defects.
