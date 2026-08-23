# Business Requirements Document (BRD)

## SDLC Agents for Enterprise — SA4E-187: Steering Conditional Loading — fileMatch + manual trigger from engine

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-187 |
| Title | Steering Conditional Loading — fileMatch + manual trigger from engine |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-08-22 |
| Status | Draft |

---

## 1. Introduction

### 1.1 Scope
Steering files with inclusion: manual and inclusion: fileMatch must actually trigger from the LangGraph engine. Engine can inject manual steering rules when triggered by agent/user action, and auto-load fileMatch steering rules when agent reads/writes files matching fileMatchPattern.

### 1.2 Out of Scope
- Changes to steering file syntax parsing outside fileMatchPattern and manual inclusion.
- Changes to core LLM provider switching.

### 1.3 Preliminary Requirement
- steering-loader.ts already parses fileMatchPattern
- Hook into tool execution pipeline postToolUse for reads

---

## 2. Business Requirements

### 2.1 High Level Process Map
User/Agent triggers steering load → Engine evaluates inclusion condition → Rule injected into next LLM turn.

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|------------------|----------|---------------|
| 1 | As a Scrum Master agent, I want manual steering rules injectable via slash command/tool call so that I can trigger context on demand | MUST HAVE | SA4E-187 |
| 2 | As a Dev agent, I want fileMatch steering rules auto-load when I read/write matching files so that context is always relevant | MUST HAVE | SA4E-187 |

### 2.3 Details of User Stories

#### STORY 1: Manual steering rule trigger
**Requirement Details:**
1. Engine can inject manual steering rules when triggered by agent/user action
2. Manual rules loadable via slash command or explicit tool call

**Acceptance Criteria:**
1. R4: Engine can inject manual steering rules when triggered by agent/user action
2. R4: Manual rules loadable via slash command or explicit tool call

#### STORY 2: fileMatch steering auto-load
**Requirement Details:**
1. When agent reads/writes a file matching fileMatchPattern, auto-load that steering rule
2. File match evaluated on every read_file/write_file tool execution
3. Steering rules injected into next LLM turn (not requiring graph recompile)
4. Performance: fileMatch evaluation < 5ms per tool call
5. Deduplication: same rule not loaded twice in same session

**Acceptance Criteria:**
1. R5: When agent reads/writes a file matching fileMatchPattern, auto-load that steering rule
2. R5: File match evaluated on every read_file/write_file tool execution
3. Steering rules injected into next LLM turn
4. Performance < 5ms per tool call
5. Deduplication works

---

## 3. Dependencies
| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| steering-loader.ts | System | SA4E-187 | Parses fileMatchPattern |

## 4. Stakeholders
| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| BA | BA Agent | BRD author | SA4E-187 |
| SM | SM Agent | Orchestration | SA4E-187 |

## 5. Risks and Assumptions
### 5.1 Risks
| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Performance regression on tool calls | Medium | Medium | Benchmark fileMatch evaluation <5ms |
| Duplicate rule injection | Medium | Low | Deduplication cache |

### 5.2 Assumptions
- steering-loader.ts already parses fileMatchPattern
- Hook mechanism askAgent / state.steeringRules append available

## 6. Non-Functional Requirements
| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | fileMatch evaluation <5ms per tool call | Benchmark required |
| Availability | Steering injection must not break graph execution | Graceful fallback |

## 7. Related Tickets
| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| SA4E-187 | Steering Conditional Loading — fileMatch + manual trigger from engine | To Do | Story | Main ticket |

## 8. Appendix
Technical Notes from Jira:
- steering-loader.ts already parses fileMatchPattern
- Need hook into tool execution pipeline (postToolUse for reads)
- Inject via hook mechanism (askAgent) or state.steeringRules append
- Consider steering cache invalidation when file changes

## 9. Diagrams
- Use Case: documents/SA4E-187/diagrams/use-case.png
- Business Flow: documents/SA4E-187/diagrams/business-flow.png
- System Context: documents/SA4E-187/diagrams/system-context.png

