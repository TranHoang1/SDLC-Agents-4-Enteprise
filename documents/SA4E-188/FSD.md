# Functional Specification Document (FSD)

## Skill Auto-Activation System — SA4E-188: Skill Auto-Activation — Auto-invoke skills, /slash-command mapping, preload

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-188 |
| Title | Skill Auto-Activation — Auto-invoke skills, /slash-command mapping, preload |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-08-23 |
| Status | Draft |
| Related BRD | documents/SA4E-188/BRD.md |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-23 | BA Agent | Initiate document — auto-generated from BRD and Jira tickets |

---

## 1. Introduction

### 1.1 Purpose

Define functional behavior for automatic skill activation, slash command mapping, and agent frontmatter skill preloading.

### 1.2 Scope

Implements auto-detection of relevant skills per user message, dynamic slash menu registration from .code-intel/skills/, and preloading SKILL.md content into agent system prompt based on frontmatter.

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| Skill | Reusable agent capability defined in SKILL.md |
| Auto-activation | Automatic skill selection based on context |
| Preload | Inject skill content into agent system prompt at compile time |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | documents/SA4E-188/BRD.md |
| Jira Ticket | SA4E-188 |

---

## 2. System Overview

### 2.1 System Context Diagram

Agent system interacts with user messages, skill registry, and slash menu controller.

### 2.2 System Architecture

Components: Message Ingress, Skill Matcher, Slash Menu Controller, Agent Compiler, Skill Registry (.code-intel/skills/).

---

## 3. Functional Requirements

### 3.1 Feature: Auto-activation of Skills

**Source:** BRD Story 1

#### 3.1.1 Description

Agent detects relevant skill based on user request keywords matching skill description and auto-activates.

#### 3.1.2 Use Case

**Use Case ID:** UC-001
**Actor:** Agent System
**Preconditions:** Skill descriptions indexed
**Postconditions:** Relevant skill activated and user notified

**Main Flow:**
| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | User | | Sends message |
| 2 | | Skill Matcher | Matches message keywords to skill descriptions |
| 3 | | Agent System | Activates skill and notifies user |

**Alternative Flows:**
| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | No skill match | Continue without activation |

**Exception Flows:**
| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | Matching latency >50ms | Log warning, degrade to keyword only |

#### 3.1.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-001 | Skill matching runs on each user message | SA4E-188 |
| BR-002 | Performance <50ms | SA4E-188 |

#### 3.1.4 Data Specifications

**Input Data:**
| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| userMessage | string | Y | max 8000 chars | User input |

**Output Data:**
| Field | Type | Description |
|-------|------|-------------|
| matchedSkill | string | Skill ID if matched |
| notification | string | Activation notice to user |

#### 3.1.5 API Contract (Functional View)

**Endpoint:** `POST /skill/match`
**Purpose:** Determine relevant skill for message

**Input Parameters:**
| Parameter | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| message | string | Y | BR-001 | User message |

**Output Data:**
| Field | Type | Description |
|-------|------|-------------|
| skillId | string | Matched skill ID |
| confidence | number | Match score |

---

### 3.2 Feature: Slash Command Mapping

**Source:** BRD Story 2

#### 3.2.1 Description

Slash commands directly invoke skills and are dynamically registered from skill directory.

---

### 3.3 Feature: Skill Preloading

**Source:** BRD Story 3

#### 3.3.1 Description

Agent frontmatter specifies skills to preload; SKILL.md content injected into system prompt at compile time.

---

## 4. Data Model

Logical entities: Skill, AgentFrontmatter, SlashCommand.

---

## 5. Integration Specifications

None external.

---

## 6. Processing Logic

### 6.1 Skill Matching Process

**Trigger:** User message received
**Processing Steps:**
| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Extract keywords from message | Log if empty |
| 2 | Compute similarity to skill descriptions | Fallback to keyword |
| 3 | Return top match if confidence > threshold | No match -> proceed |

---

## 7. Security Requirements

No sensitive data.

---

## 8. Non-Functional Requirements

| Category | Business Requirement | Acceptance Criteria |
|----------|---------------------|---------------------|
| Performance | Skill matching <50ms | Measured in tests |
| Availability | Always available | No downtime |

---

## 9. Error Handling

| Scenario | Severity | User Message | Expected Behavior |
|----------|----------|-------------|-------------------|
| No skill found | Info | No activation | Continue normally |
| Matching timeout | Warning | Skill activation delayed | Use fallback |

---

## 10. Testing Considerations

| ID | Scenario | Input | Expected Output | Priority |
|----|----------|-------|-----------------|----------|
| TC-001 | Keyword match | "use browser to scrape" | browser-harness skill activated | High |
| TC-002 | Slash command | "/browser-harness" | Skill invoked directly | High |
| TC-003 | Preload | Agent frontmatter skills:[x] | System prompt contains SKILL.md | High |

---

## 11. Appendix

Change Log from BRD: No deviations.
