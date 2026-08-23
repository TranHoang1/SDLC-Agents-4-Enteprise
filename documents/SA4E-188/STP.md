# Software Test Plan (STP)

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

## 1. Introduction

### 1.1 Purpose

Test skill auto-activation, slash command mapping, and preload functionality.

### 1.2 Test Objectives

- Verify auto-activation works per FSD
- Verify slash commands invoke skills
- Verify preload injects SKILL.md

---

## 2. Test Strategy

### 2.1 Test Levels

Unit, Integration, System, UAT

### 2.2 Test Types

Functional Testing: Yes
Performance Testing: Yes (<50ms)

---

## 3. Test Scope

### 3.1 Features In Scope

| # | Feature | Priority |
|---|---------|----------|
| 1 | Auto-activation | High |
| 2 | Slash command | High |
| 3 | Preload | High |

---

## 9. Test Metrics

Pass Rate ≥ 95%

---

## Appendix

Assumptions: L3 autonomy.
