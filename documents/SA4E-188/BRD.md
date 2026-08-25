# Business Requirements Document (BRD)

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

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent – Business Analyst | Create document |
| Peer Reviewer | TA Agent – Technical Architect | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-23 | BA Agent | Initiate document — auto-generated from Jira ticket SA4E-188 and linked tickets |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |

---

## 1. Introduction

### 1.1 Scope

Skills must activate automatically based on context, be invocable via slash commands, and preloadable into agent context. Gap Reference: R6 + R7 + R9.

### 1.2 Out of Scope

Custom skill runtime beyond activation/mapping/preload. Integration with external skill registries outside .code-intel/skills/.

### 1.3 Preliminary Requirement

find_skill MCP tool exists with keyword matching logic. SlashMenuController exists. Agent frontmatter schema supports skills list.

---

## 2. Business Requirements

### 2.1 High Level Process Map

User message -> Skill auto-detection -> Auto-activation notification -> Slash command invocation -> Preloaded skill context injection.

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case / Epic | Priority | Source Ticket |
|---|-------------------------|----------|---------------|
| 1 | As an agent, I want skills to auto-activate based on user request keywords so that relevant skills are applied without manual discovery | MUST HAVE | SA4E-188 |
| 2 | As a user, I want to invoke skills via /skill-name slash command so that I can directly trigger skill functionality | MUST HAVE | SA4E-188 |
| 3 | As an agent author, I want to specify skills in agent frontmatter for preloading so that skills are available in system prompt at runtime | MUST HAVE | SA4E-188 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** User submits message to agent

**Step 2:** System performs lightweight keyword/embedding match against skill descriptions

**Step 3:** If match exceeds threshold, auto-activate skill and notify user

**Step 4:** User can also invoke skill via /skill-name slash command

**Step 5:** Agent frontmatter skills are preloaded at graph compile time

> **Note:** Skill matching must be < 50ms

---

#### STORY 1: Auto-activation of Skills

> As an agent, I want skills to auto-activate based on user request keywords so that relevant skills are applied without manual discovery

**Requirement Details:**

1. Agent detects when skill is relevant based on user request keywords matching skill description
2. Skill matching runs on each user message (lightweight keyword/embedding match)

**Acceptance Criteria:**

1. R6: Auto-activation — agent detects when skill is relevant based on user request keywords matching skill description
2. R6: Skill matching runs on each user message (lightweight keyword/embedding match)
3. Performance: skill matching < 50ms
4. Skill activation notification shown to user

---

#### STORY 2: Slash Command Mapping

> As a user, I want to invoke skills via /skill-name slash command so that I can directly trigger skill functionality

**Requirement Details:**

1. /skill-name slash command directly invokes corresponding skill
2. Skills registered as slash menu items (dynamic from .code-intel/skills/)

**Acceptance Criteria:**

1. R7: /skill-name slash command directly invokes corresponding skill
2. R7: Skills registered as slash menu items (dynamic from .code-intel/skills/)

---

#### STORY 3: Skill Preloading

> As an agent author, I want to specify skills in agent frontmatter for preloading so that skills are available in system prompt at runtime

**Requirement Details:**

1. Agent frontmatter can specify skills: [skill1, skill2] for preloading
2. Preloaded skills SKILL.md content injected into agent system prompt

**Acceptance Criteria:**

1. R9: Agent frontmatter can specify skills: [skill1, skill2] for preloading
2. R9: Preloaded skills SKILL.md content injected into agent system prompt

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| find_skill MCP tool | System | N/A | Keyword matching logic exists |
| SlashMenuController | System | N/A | Can register dynamic items from skills scan |
| Agent graph compile | System | N/A | Read SKILL.md at compile time if listed |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Reporter | Duc Nguyen Minh | Requirement owner | Jira |
| Parent Epic | SA4E-181 | Chat Module — OpenCode Parity + Agentic Config System | Jira |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Matching latency >50ms | Medium | Medium | Use lightweight keyword first, fallback to embedding |
| Skill description ambiguity | Medium | Medium | Require clear skill description metadata |

### 5.2 Assumptions

- find_skill already has keyword matching logic
- Skills are stored under .code-intel/skills/
- Agent frontmatter is parsed at compile time

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Skill matching < 50ms | Lightweight keyword/embedding match |
| Security | Skill activation notification shown to user | Transparency |
| Scalability | Dynamic skill registration | Support growth of skills |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| SA4E-188 | Skill Auto-Activation — Auto-invoke skills, /slash-command mapping, preload | To Do | Story | Main ticket |
| SA4E-181 | Chat Module — OpenCode Parity + Agentic Config System | Done | Epic | Parent |

---

## 8. Appendix

### Technical Notes

- find_skill already has keyword matching logic
- SlashMenuController can register dynamic items from skills scan
- Preload: read SKILL.md at graph compile time if listed in agent frontmatter
- Auto-activation: embed skill descriptions, cosine similarity on user prompt

### Glossary

| Term | Definition |
|------|------------|
| Skill | Reusable agent capability defined in SKILL.md |
| Auto-activation | Automatic skill selection based on context |
| Preload | Inject skill content into agent system prompt at compile time |
