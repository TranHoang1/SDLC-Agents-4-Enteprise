---
applyTo: "**/*.kt,**/*.ts,**/*.java"
---

# DEV Bug Diagnosis Loop

## Core Rule

> "No red-capable command, no fix attempt."
> DEV CANNOT attempt a fix without a failing reproduction test.

## Trigger: Jira type = Bug, SM says "Fix bugs", QA reports failure

## 6-Phase Loop

1. **Build** — verify project compiles, tests run
2. **Reproduce** — write FAILING test showing the bug
3. **Hypothesise** — specific file/line/condition (max 3)
4. **Instrument** — add logging to confirm hypothesis
5. **Fix** — smallest change, reproduction test passes, no regressions
6. **Cleanup** — remove debug code, proper commit message

## Report Format

```
## Bug Fix Report — {TICKET}
Root Cause: {explanation}
Files Changed: {list}
Reproduction Test: {name}
Fix: {description}
Regression: All {N} tests pass
```

## FORBIDDEN

- No guess-and-check without failing test
- No shotgun fix (change many things)
- No skip cleanup / leave debug code
- No bug fix + refactor in same commit
