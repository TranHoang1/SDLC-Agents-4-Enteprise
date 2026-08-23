# Software Test Plan (STP)

## SA4E-189: Hot-Reload System — Extension Agent List UI

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-189 |
| Title | Hot-Reload System — Extension FileSystemWatcher reactive agent list |
| Author | QA Agent |
| Version | 1.1 |
| Date | 2026-08-23 |
| Status | Draft |
| Related BRD | BRD.md |
| Related FSD | FSD.md |
| Related TDD | TDD.md |

---

## 1. Introduction

### 1.1 Purpose
Test plan for extension hot-reload: FileSystemWatcher monitors `.kiro/agents/**/*.md` and refreshes agent list UI via `sendAgentsInfo()` with 300ms debounce.

### 1.2 Test Objectives
- Verify agent file create/modify/delete triggers UI refresh
- Verify debounce timing
- Verify watcher dispose
- Verify no backend impact

---

## 2. Test Strategy

| Level | Scope | Automation |
|-------|-------|------------|
| UT | ChatStateManager watcher logic | Automated |
| IT | Extension activation + watcher | Manual |
| E2E-UI | Agent list updates in Kiro | Manual |

---

## 3. Test Scope

**In Scope**
- UC1: Agent file change → UI update
- UC2: Debounce
- UC3: Watcher dispose

**Out of Scope**
- Backend prompt reload, steering/hooks

---

## 4. Test Environment

- Kiro IDE with extension v1.33.0
- Workspace with `.kiro/agents/`

---

## 5. Entry/Exit Criteria

Entry: Extension built and installed
Exit: All UI update tests passed

---

*Updated for extension-only hot-reload*
