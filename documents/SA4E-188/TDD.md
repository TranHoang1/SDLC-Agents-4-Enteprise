# Technical Design Document (TDD)

## Skill Auto-Activation System — SA4E-188: Skill Auto-Activation — Auto-invoke skills, /slash-command mapping, preload

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-188 |
| Title | Skill Auto-Activation — Auto-invoke skills, /slash-command mapping, preload |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-08-23 |
| Status | Draft |
| Related BRD | documents/SA4E-188/BRD.md |
| Related FSD | documents/SA4E-188/FSD.md |

---

## 1. Introduction

### 1.1 Purpose

Design technical implementation for skill auto-activation, slash command mapping, and frontmatter preload.

### 1.2 Scope

Modify message processing pipeline to perform skill matching, dynamic slash menu registration, and agent compiler preloading.

### 1.3 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Language | TypeScript | 5.x |
| Framework | Node.js | 20.x |
| Build Tool | npm | 10.x |

### 1.4 Design Principles

- SOLID
- KISS

---

## 2. System Architecture

### 2.1 Architecture Overview

Message ingress -> SkillMatcher -> SlashMenuController -> AgentCompiler

### 2.2 Component Diagram

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| SkillMatcher | Keyword/embedding match | TypeScript |
| SlashMenuController | Dynamic registration | TypeScript |
| AgentCompiler | Frontmatter preload | TypeScript |

---

## 3. API Design

### 3.1 API Overview

| # | Endpoint | Method | Description |
|---|----------|--------|-------------|
| 1 | /skill/match | POST | Match skill to message |

---

## 5. Class / Module Design

### 5.1 Package Structure

```
src/
├── skill/
│   ├── SkillMatcher.ts
│   ├── SlashMenuController.ts
│   └── AgentCompiler.ts
```

### 5.2 Key Interfaces

```typescript
export interface ISkillMatcher {
  match(message: string): Promise<SkillMatchResult>;
}
```

---

## 7. Security Design

No sensitive data handling.

---

## 8. Performance & Scalability

Skill matching <50ms via keyword first then embedding fallback.

---

## 9. Monitoring & Observability

Log skill activation events.

---

## 10. Deployment Considerations

Feature flag: SKILL_AUTO_ACTIVATION_ENABLED

---

## Appendix

Diagrams to be created per mandatory requirements.
