# Functional Specification Document (FSD)

## SDLC Agents for Enterprise — SA4E-187: Steering Conditional Loading — fileMatch + manual trigger from engine

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-187 |
| Title | Steering Conditional Loading — fileMatch + manual trigger from engine |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-08-22 |
| Status | Draft |
| Related BRD | documents/SA4E-187/BRD.md |

---

## 1. Introduction

### 1.1 Purpose
Specify functional requirements for conditional steering rule loading via manual trigger and fileMatch pattern from LangGraph engine.

### 1.2 Scope
Engine hooks into read_file/write_file tool executions, evaluates fileMatchPattern, and injects manual steering rules on slash command/tool call.

### 1.3 Definitions
| Term | Definition |
|------|------------|
| fileMatch | inclusion: fileMatch steering rule |
| manual | inclusion: manual steering rule |

---

## 2. System Overview

### 2.1 System Context
LangGraph engine → steering-loader → LLM turn with injected steering rules.

### 2.2 Architecture
- steering-loader.ts parses fileMatchPattern
- Tool execution hook postToolUse
- Steering cache per session

---

## 3. Functional Requirements

### 3.1 Feature: Manual Steering Trigger

**Source:** BRD Story 1

#### 3.1.1 Description
Engine can inject manual steering rules when triggered by agent/user action.

#### 3.1.2 Use Case
**UC-01**
Actor: SM Agent / User
Preconditions: Steering rule exists with inclusion: manual
Main Flow:
1. User invokes slash command / tool call
2. Engine loads rule into state.steeringRules
3. Rule injected into next LLM turn

**Acceptance Criteria:**
- R4: Engine can inject manual steering rules when triggered
- R4: Manual rules loadable via slash command or explicit tool call

### 3.2 Feature: fileMatch Auto-Load

**Source:** BRD Story 2

#### 3.2.1 Description
When agent reads/writes file matching fileMatchPattern, auto-load steering rule.

#### 3.2.2 API Contracts
**Tool Execution Hook**
Input: tool_name, file_path
Output: matched steering rules []
Performance: <5ms per call

**Acceptance Criteria:**
- R5: Auto-load on file read/write match
- Evaluation on every read_file/write_file
- Inject into next LLM turn without recompile
- Performance <5ms
- Deduplication per session

### 3.3 Data Model
| Entity | Field | Type | Required |
|--------|-------|------|----------|
| SteeringRule | id | string | Yes |
| SteeringRule | inclusion | enum | Yes |
| SteeringRule | fileMatchPattern | string | No |

---

## 4. Non-Functional Requirements
- Performance: fileMatch evaluation <5ms per tool call
- Deduplication: same rule not loaded twice per session

## 5. Open Issues
- Steering cache invalidation when file changes → TBD

---

## 6. Appendix
Enriched by TA Agent with API contracts and pseudocode.

## 7. Diagrams
- Sequence: documents/SA4E-187/diagrams/sequence.png
- State: documents/SA4E-187/diagrams/state.png
- Architecture: documents/SA4E-187/diagrams/architecture.png

