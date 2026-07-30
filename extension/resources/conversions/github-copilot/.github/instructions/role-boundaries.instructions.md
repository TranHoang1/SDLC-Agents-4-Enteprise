---
name: 'Role Boundaries'
description: 'Agent responsibility matrix — what each agent can/cannot do'
applyTo: '**'
---

# Agent Role Boundaries — Responsibility Matrix

## Role Matrix

| Agent | Creates/Writes | CANNOT do |
|---|---|---|
| **sm-agent** | STATUS.json, RUN-LOG.md, jira.conf | ❌ Write documents, code, diagrams, tests |
| **ba-agent** | BRD.md, FSD.md (draft), diagrams | ❌ Write TDD, code, tests, DPG |
| **ta-agent** | FSD.md (enrichment only) | ❌ Write BRD, TDD, code, tests |
| **sa-agent** | TDD.md, DISCREPANCY.md, diagrams | ❌ Write BRD, FSD, code, tests |
| **qa-agent** | STP.md, STC.md, TEST-REPORT.md, CSVs | ❌ Write BRD, FSD, TDD, production code |
| **dev-agent** | Source code, tests, UG.md | ❌ Write BRD, FSD, TDD, STP, DPG |
| **devops-agent** | CI/CD configs, DPG.md, RLN.md, Dockerfile | ❌ Write BRD, FSD, TDD, STP, application code |
| **ui-agent** | Wireframes, UI specs, draw.io mockups | ❌ Write backend code, TDD, STP |
| **security-agent** | SECURITY-REVIEW/ASSESSMENT/PENTEST-REPORT | ❌ Write feature code, fix code (only report) |

## SM is COORDINATOR — not implementor

SM's job: Discover → Decide → Invoke → Verify → Report → Transition

SM NEVER:
- Writes document content
- Acts as another agent
- Performs code reviews (delegate to dev or qa)
- Generates diagrams

## Sub-Agent Self-Check

Before starting work, each agent MUST verify scope:
1. Output in my "Creates/Writes" column? → Proceed
2. Output in my "CANNOT do" column? → REFUSE: "⛔ Outside my scope. Correct agent: {name}"
3. Modifying another agent's output? → Only if SM explicitly instructs for feedback loop

## Cross-Agent Collaboration

| Scenario | Correct Flow |
|---|---|
| BRD needs update after SA feedback | SM → invoke ba-agent |
| Code review needed | SM → invoke dev-agent (standards) + qa-agent (spec) |
| Tests need writing | SM → invoke dev-agent |
| TDD needs diagrams | SM → invoke sa-agent |
| Deploy guide needed | SM → invoke devops-agent |