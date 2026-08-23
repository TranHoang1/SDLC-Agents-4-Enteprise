# Software Test Cases (STC)

## Skill Auto-Activation System — SA4E-188: Skill Auto-Activation — Auto-invoke skills, /slash-command mapping, preload

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-188 |
| Title | Skill Auto-Activation — Auto-invoke skills, /slash-command mapping, preload |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-08-23 |
| Status | Draft |

---

## Test Case Summary

| Category | Count |
|----------|-------|
| Functional | 3 |

---

## 1. Functional Test Cases

### TC-001: Auto-activation keyword match

| Field | Value |
|-------|-------|
| ID | TC-001 |
| Priority | High |
| Requirement | R6 Auto-activation |

**Test Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send message "scrape website" | browser-harness skill auto-activated |
| 2 | Check notification | User notified of activation |

---

### TC-002: Slash command invocation

| Field | Value |
|-------|-------|
| ID | TC-002 |
| Priority | High |
| Requirement | R7 Slash command |

**Test Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send "/browser-harness" | Skill invoked directly |

---

### TC-003: Frontmatter preload

| Field | Value |
|-------|-------|
| ID | TC-003 |
| Priority | High |
| Requirement | R9 Preload |

**Test Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Load agent with skills:[x] | System prompt contains SKILL.md content |

---
