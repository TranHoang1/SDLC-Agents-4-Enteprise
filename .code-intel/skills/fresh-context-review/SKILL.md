---
name: fresh-context-review
description: "Isolated code review technique where reviewer receives ONLY diff + specs, with no implementation history. Use for large features, security-sensitive changes, or complex refactoring."
---

# fresh-context-review

Eliminates reviewer bias by spawning a separate agent with limited context — only the git diff and specification documents. No conversation history, no RUN-LOG, no STATUS.json.

## When to Use

- Large features (>500 lines changed)
- Security-sensitive code (auth, encryption, access control)
- Data model changes (DB schema, migrations)
- Complex refactoring (>5 files modified)
- Any change where "reviewer fatigue" or "agree with author" bias is suspected

## How SM Invokes Fresh-Context Review

SM spawns a separate sub-agent with **strictly limited contextFiles**:

```
invokeSubAgent(
  name: "dev-agent",
  prompt: "INDEPENDENT CODE REVIEW — Fresh Context

  You are reviewing code changes for the FIRST time with NO prior context.
  You have NEVER seen this code before. Form your OWN assessment.

  ## Diff
  {paste git diff output here}

  ## Task
  Review against TDD specs + code-standards. Report findings table.

  ## Rules
  - Do NOT assume implementation intent
  - Do NOT reference any prior discussion
  - Judge ONLY what code does vs what specs require
  - Flag anything that SURPRISES you
  ",
  contextFiles: [
    { "path": "documents/{TICKET}/TDD.md" },
    { "path": "documents/{TICKET}/FSD.md" },
    { "path": ".kiro/steering/code-standards.md" }
  ]
)
```

**Critical:** Do NOT include RUN-LOG.md, STATUS.json, BRD.md, or any session history in contextFiles.

## Prompt Template — Standards Axis (Fresh)

```
INDEPENDENT CODE REVIEW — Standards (Fresh Context)

Review this diff for code quality and standards compliance.
You have ZERO context about WHY these changes were made.

CHECK:
1. File size ≤ 200 lines?
2. Function size ≤ 20 lines?
3. SOLID violations?
4. Fowler code smells?
5. Model/processing separation?
6. Design patterns used appropriately?
7. Exception handling — no swallowed exceptions?
8. Zod validation on protocol boundaries?

OUTPUT:
| # | File | Line | Issue | Severity | Smell |
|---|------|------|-------|----------|-------|

Verdict: PASS / PASS-WITH-WARNINGS / FAIL
```

## Prompt Template — Spec Compliance Axis (Fresh)

```
INDEPENDENT CODE REVIEW — Spec Compliance (Fresh Context)

Review this diff against the attached TDD and FSD.
You have ZERO context about implementation decisions.

CHECK:
1. Missing features from TDD not implemented?
2. Scope creep — code doing things NOT in specs?
3. API contracts match TDD exactly?
4. Business rules from FSD all implemented?
5. Error codes handled correctly?
6. Security design from TDD followed?

OUTPUT:
| # | Spec Section | Expected | Actual | Severity |
|---|-------------|----------|--------|----------|

Verdict: PASS / PASS-WITH-WARNINGS / FAIL
```

## Comparison Reporting

After fresh review completes, SM compares with standard (context-aware) review:

```markdown
## Fresh-Context Review Comparison — {TICKET}

### Blind Spots (fresh found, standard missed)
| # | Issue | Implication |
|---|-------|-------------|

### Context-Dependent (standard found, fresh missed)
| # | Issue | Why context was needed |
|---|-------|----------------------|

### Agreement Rate: {N}%
### Action: {BLOCK / FIX / LOG / NONE}
```

## Decision Matrix

| Fresh Finds Critical + Standard Missed | → BLOCK pipeline, DEV must fix |
| Fresh Finds High + Standard Missed | → DEV fix or user risk acceptance |
| Only Medium/Low blind spots | → Log tech debt, proceed |
| Fresh finds nothing new | → Confirms standard review quality |

## Anti-Patterns

| ❌ Don't | ✅ Do |
|----------|------|
| Include RUN-LOG in fresh review context | Only diff + TDD + FSD + standards |
| Use phrases like "as previously discussed" | Force independent assessment |
| Skip fresh review for security changes | Always run for auth/crypto code |
| Run fresh review for trivial changes | Only when criteria met (>500 LOC, security, etc.) |
| Let same agent do both reviews | Use separate invocations with different context |
